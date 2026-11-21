package com.jmbarber.api.appointments;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;
import com.jmbarber.api.appointments.AppointmentEnums.Status;

/** Cuerpos de /appointments (docs/contratos/api-rest.md §4). */
public final class AppointmentDtos {

    static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private AppointmentDtos() {
    }

    /** Nombre que se muestra para las citas de un cliente que fue eliminado (contrato §9). */
    public static final String DELETED_CLIENT = "Cliente eliminado";

    /** Nunca lleva correo ni teléfono del cliente: solo nombre y apellido (spec F3, tarea 3.21). */
    public record AppointmentResponse(String id, String clientId, String clientName, String serviceId,
                                      String serviceName, String durationLabel, LocalDate date, String time,
                                      String endTime, String status, String notes, String paymentStatus,
                                      String paymentMethod) {

        public static AppointmentResponse from(Appointment a) {
            return new AppointmentResponse(a.getId(), a.getClient() == null ? null : a.getClient().getId(),
                AppointmentDtos.clientName(a), a.getService().getId(), a.getService().getName(), a.getService().getDurationLabel(),
                a.getDate(), format(a.getTime()), format(a.getEndTime()), a.getStatus().name(), a.getNotes(),
                a.getPaymentStatus().name(), a.getPaymentMethod() == null ? null : a.getPaymentMethod().name());
        }
    }

    /** Rango ocupado de la agenda, sin datos de nadie (GET /appointments/booked-ranges). */
    public record BookedRange(String start, String end) {
    }

    /** "Nombre Apellido" del cliente, o "Cliente eliminado" si ya no existe. */
    public static String clientName(Appointment a) {
        if (a.getClient() == null) {
            return DELETED_CLIENT;
        }
        return (a.getClient().getFirstName() + " " + a.getClient().getLastName()).trim();
    }

    public record CreateAppointmentRequest(
        @NotBlank(message = "Faltan datos requeridos de la reserva.") String serviceId,
        @NotNull(message = "Faltan datos requeridos de la reserva.") LocalDate date,
        @NotNull(message = "Faltan datos requeridos de la reserva.")
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "La hora debe tener el formato HH:mm.") String time,
        @Size(max = 500, message = "Las notas no pueden superar 500 caracteres.") String notes
    ) {
    }

    /** Ajuste de pago (solo ADMIN). Los montos ausentes cuentan como 0. */
    public record PaymentRequest(
        @NotNull(message = "Selecciona el método de pago.") PaymentMethod paymentMethod,
        BigDecimal discountAmount,
        BigDecimal refundAmount,
        BigDecimal tipAmount
    ) {
    }

    public record PaymentResponse(String id, String paymentStatus, String paymentMethod, long grossAmount,
                                  long discountAmount, long refundAmount, long tipAmount, long netAmount) {

        public static PaymentResponse from(Appointment a) {
            long gross = a.getGrossAmount() == null ? 0 : a.getGrossAmount().longValue();
            long discount = a.getDiscountAmount().longValue();
            long refund = a.getRefundAmount().longValue();
            return new PaymentResponse(a.getId(), a.getPaymentStatus().name(), a.getPaymentMethod().name(), gross,
                discount, refund, a.getTipAmount().longValue(), gross - discount - refund);
        }
    }

    public record StatusRequest(@NotNull(message = "Indica el nuevo estado de la cita.") Status status) {
    }

    static String format(LocalTime time) {
        return time.format(HH_MM);
    }
}
