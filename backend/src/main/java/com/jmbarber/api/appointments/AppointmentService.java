package com.jmbarber.api.appointments;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.appointments.AppointmentDtos.AppointmentResponse;
import com.jmbarber.api.appointments.AppointmentDtos.BookedRange;
import com.jmbarber.api.appointments.AppointmentDtos.CreateAppointmentRequest;
import com.jmbarber.api.appointments.AppointmentDtos.PaymentRequest;
import com.jmbarber.api.appointments.AppointmentDtos.PaymentResponse;
import com.jmbarber.api.appointments.AppointmentEnums.Status;
import com.jmbarber.api.common.ApiError;
import com.jmbarber.api.common.ApiException;
import com.jmbarber.api.hours.BusinessHours;
import com.jmbarber.api.hours.BusinessHoursRepository;
import com.jmbarber.api.services.BarberService;
import com.jmbarber.api.services.BarberServiceRepository;
import com.jmbarber.api.users.Role;
import com.jmbarber.api.users.User;
import com.jmbarber.api.users.UserRepository;

/** Reglas de citas (specs F2 y F3). La validación de dueño vive aquí, no en el controlador. */
@Service
public class AppointmentService {

    static final String PAST_SLOT = "No puedes reservar en una fecha u hora que ya pasó.";
    static final String SLOT_TAKEN = "Este bloque horario ya está ocupado. Por favor elige otro turno.";
    static final String OUTSIDE_HOURS = "Ese horario no está disponible. Elige un turno de la lista.";
    static final String SERVICE_INACTIVE = "Este servicio no está disponible.";
    static final String CANNOT_CANCEL = "Esta cita ya no se puede cancelar.";
    static final String NOT_COMPLETED = "Solo se puede ajustar el pago de una cita completada.";
    static final String ADJUSTMENT_TOO_HIGH = "El descuento y el reembolso no pueden superar el valor del servicio.";
    static final String NEGATIVE_ADJUSTMENT = "El descuento y el reembolso no pueden ser negativos.";
    static final String NEGATIVE_TIP = "La propina no puede ser negativa.";

    private final AppointmentRepository appointments;
    private final BarberServiceRepository services;
    private final BusinessHoursRepository hours;
    private final UserRepository users;
    private final Clock clock;

    public AppointmentService(AppointmentRepository appointments, BarberServiceRepository services,
                              BusinessHoursRepository hours, UserRepository users, Clock clock) {
        this.appointments = appointments;
        this.services = services;
        this.hours = hours;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<String> bookedSlots(LocalDate date) {
        return appointments.findBookedTimes(date).stream().map(AppointmentDtos::format).distinct().toList();
    }

    @Transactional
    public AppointmentResponse create(String userId, CreateAppointmentRequest req) {
        LocalTime time = LocalTime.parse(req.time(), AppointmentDtos.HH_MM);

        BarberService service = services.findById(req.serviceId())
            .orElseThrow(() -> ApiException.notFound("El servicio no existe."));
        if (!service.isActive()) {
            throw ApiException.badRequest(SERVICE_INACTIVE);
        }
        if (!LocalDateTime.of(req.date(), time).isAfter(LocalDateTime.now(clock))) {
            throw ApiException.badRequest(PAST_SLOT);
        }

        // Cerrojo: bloquea la fila del horario hasta el commit, para que revisar el solapamiento
        // y guardar ocurra de a una reserva a la vez (MySQL no tiene EXCLUDE de rangos).
        BusinessHours h = hours.lockById(BusinessHours.SINGLE_ROW_ID)
            .orElseThrow(() -> ApiException.badRequest(OUTSIDE_HOURS));
        LocalTime end = rangeEnd(h, req.date(), time, service.getDurationMinutes());
        if (end == null) {
            throw ApiException.badRequest(OUTSIDE_HOURS);
        }
        if (appointments.overlaps(req.date(), time, end, "")) {
            throw slotTaken();
        }

        User client = users.findById(userId).orElseThrow(AppointmentService::sessionGone);
        String notes = req.notes() == null || req.notes().isBlank() ? null : req.notes().trim();
        Appointment appointment = Appointment.book(client, service, req.date(), time, end, notes);
        try {
            appointments.saveAndFlush(appointment); // el índice UNIQUE resuelve dos reservas simultáneas
        } catch (DataIntegrityViolationException ex) {
            throw slotTaken();
        }
        return AppointmentResponse.from(appointment);
    }

    @Transactional(readOnly = true)
    public Optional<AppointmentResponse> next(String userId) {
        LocalDateTime now = LocalDateTime.now(clock);
        return appointments.findUpcoming(userId, now.toLocalDate(), now.toLocalTime(), PageRequest.of(0, 1))
            .stream().findFirst().map(AppointmentResponse::from);
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> agenda(LocalDate date) {
        return appointments.findAgenda(date).stream().map(AppointmentResponse::from).toList();
    }

    @Transactional
    public AppointmentResponse changeStatus(String userId, Role role, String appointmentId, Status newStatus) {
        Appointment appointment = appointments.findWithDetails(appointmentId)
            .orElseThrow(() -> ApiException.notFound("La cita no existe."));

        if (role == Role.CLIENTE) {
            boolean own = appointment.getClient() != null && appointment.getClient().getId().equals(userId);
            if (!own || newStatus != Status.CANCELADA) {
                throw forbidden();
            }
            if (appointment.getStatus() != Status.PENDIENTE && appointment.getStatus() != Status.CONFIRMADA) {
                throw ApiException.conflict("CANNOT_CANCEL", CANNOT_CANCEL);
            }
        }
        // Cerradura (spec F3): una cita ya cobrada solo la puede cambiar el admin; protege el cobro
        if (appointment.getStatus() == Status.COMPLETADA && role != Role.ADMIN) {
            throw forbidden();
        }

        Status previous = appointment.getStatus();
        if (previous == Status.CANCELADA && newStatus != Status.CANCELADA) {
            // Reactivar: el turno pudo ser tomado por otra cita mientras estaba cancelada
            hours.lockById(BusinessHours.SINGLE_ROW_ID);
            if (appointments.overlaps(appointment.getDate(), appointment.getTime(), appointment.getEndTime(),
                    appointment.getId())) {
                throw slotTaken();
            }
        }
        appointment.changeStatus(newStatus, Instant.now(clock));
        if (previous == Status.CANCELADA && newStatus != Status.CANCELADA) {
            try {
                appointments.flush(); // segunda barrera: el UNIQUE del turno activo
            } catch (DataIntegrityViolationException ex) {
                throw slotTaken();
            }
        }
        return AppointmentResponse.from(appointment);
    }

    /** Ajusta método, descuento, reembolso y propina de una cita completada (contrato §4). */
    @Transactional
    public PaymentResponse adjustPayment(String appointmentId, PaymentRequest req) {
        Appointment appointment = appointments.findWithDetails(appointmentId)
            .orElseThrow(() -> ApiException.notFound("La cita no existe."));
        if (appointment.getStatus() != Status.COMPLETADA) {
            throw ApiException.conflict("NOT_COMPLETED", NOT_COMPLETED);
        }
        BigDecimal discount = pesos(req.discountAmount());
        BigDecimal refund = pesos(req.refundAmount());
        BigDecimal tip = pesos(req.tipAmount());
        if (discount.signum() < 0 || refund.signum() < 0) {
            throw ApiException.badRequest(NEGATIVE_ADJUSTMENT);
        }
        if (tip.signum() < 0) {
            throw ApiException.badRequest(NEGATIVE_TIP);
        }
        BigDecimal gross = appointment.getGrossAmount() == null
            ? appointment.getService().getPrice() : appointment.getGrossAmount();
        if (discount.add(refund).compareTo(gross) > 0) {
            throw ApiException.badRequest(ADJUSTMENT_TOO_HIGH);
        }
        appointment.adjustPayment(req.paymentMethod(), discount, refund, tip);
        return PaymentResponse.from(appointment);
    }

    private static BigDecimal pesos(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(0, RoundingMode.HALF_UP);
    }

    @Transactional(readOnly = true)
    public List<BookedRange> bookedRanges(LocalDate date) {
        return appointments.findBookedRanges(date).stream()
            .map(row -> new BookedRange(AppointmentDtos.format((LocalTime) row[0]),
                AppointmentDtos.format((LocalTime) row[1])))
            .toList();
    }

    /**
     * Fin de la cita si el rango [time, time + duración) cabe en el horario de ese día: día abierto,
     * inicio alineado con los turnos, termina a más tardar al cierre y no cruza el descanso.
     * Devuelve null si no cabe (contrato §9).
     */
    static LocalTime rangeEnd(BusinessHours h, LocalDate date, LocalTime time, int durationMinutes) {
        int weekday = date.getDayOfWeek().getValue() % 7; // 0 = domingo … 6 = sábado
        if (!h.getOpenDays().contains(weekday)) {
            return null;
        }
        int start = time.toSecondOfDay() / 60;
        int end = start + durationMinutes;
        int open = h.getOpenTime().toSecondOfDay() / 60;
        int close = h.getCloseTime().toSecondOfDay() / 60;
        if (start < open || end > close || (start - open) % h.getSlotMinutes() != 0) {
            return null;
        }
        if (h.getBreakStart() != null && h.getBreakEnd() != null) {
            int bs = h.getBreakStart().toSecondOfDay() / 60;
            int be = h.getBreakEnd().toSecondOfDay() / 60;
            if (start < be && end > bs) {
                return null;
            }
        }
        return LocalTime.ofSecondOfDay(end * 60L); // end <= close < 24 h: nunca da la vuelta
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", ApiError.FORBIDDEN_MESSAGE);
    }

    private static ApiException slotTaken() {
        return ApiException.conflict("SLOT_TAKEN", SLOT_TAKEN);
    }

    private static ApiException sessionGone() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", ApiError.UNAUTHORIZED_MESSAGE);
    }
}
