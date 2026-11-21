package com.jmbarber.api.appointments;

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
import com.jmbarber.api.appointments.AppointmentDtos.CreateAppointmentRequest;
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
        if (!isOfferedSlot(req.date(), time)) {
            throw ApiException.badRequest(OUTSIDE_HOURS);
        }
        if (appointments.isSlotTaken(req.date(), time)) {
            throw slotTaken();
        }

        User client = users.findById(userId).orElseThrow(AppointmentService::sessionGone);
        String notes = req.notes() == null || req.notes().isBlank() ? null : req.notes().trim();
        Appointment appointment = Appointment.book(client, service, req.date(), time, notes);
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
            boolean own = appointment.getClient().getId().equals(userId);
            if (!own || newStatus != Status.CANCELADA) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", ApiError.FORBIDDEN_MESSAGE);
            }
            if (appointment.getStatus() != Status.PENDIENTE && appointment.getStatus() != Status.CONFIRMADA) {
                throw ApiException.conflict("CANNOT_CANCEL", CANNOT_CANCEL);
            }
        }

        Status previous = appointment.getStatus();
        appointment.changeStatus(newStatus, Instant.now(clock));
        if (previous == Status.CANCELADA && newStatus != Status.CANCELADA) {
            try {
                appointments.flush(); // reactivar puede chocar con quien tomó el turno
            } catch (DataIntegrityViolationException ex) {
                throw slotTaken();
            }
        }
        return AppointmentResponse.from(appointment);
    }

    /** ¿La hora es uno de los turnos que ofrece el horario de atención ese día? */
    private boolean isOfferedSlot(LocalDate date, LocalTime time) {
        BusinessHours h = hours.findById(BusinessHours.SINGLE_ROW_ID).orElse(null);
        if (h == null) {
            return false;
        }
        int weekday = date.getDayOfWeek().getValue() % 7; // 0 = domingo … 6 = sábado
        if (!h.getOpenDays().contains(weekday)) {
            return false;
        }
        int t = time.toSecondOfDay() / 60;
        int open = h.getOpenTime().toSecondOfDay() / 60;
        int close = h.getCloseTime().toSecondOfDay() / 60;
        if (t < open || t >= close || (t - open) % h.getSlotMinutes() != 0) {
            return false;
        }
        if (h.getBreakStart() != null && h.getBreakEnd() != null) {
            int bs = h.getBreakStart().toSecondOfDay() / 60;
            int be = h.getBreakEnd().toSecondOfDay() / 60;
            if (t >= bs && t < be) {
                return false;
            }
        }
        return true;
    }

    private static ApiException slotTaken() {
        return ApiException.conflict("SLOT_TAKEN", SLOT_TAKEN);
    }

    private static ApiException sessionGone() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", ApiError.UNAUTHORIZED_MESSAGE);
    }
}
