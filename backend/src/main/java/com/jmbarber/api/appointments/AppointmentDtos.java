package com.jmbarber.api.appointments;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.jmbarber.api.appointments.AppointmentEnums.Status;

/** Cuerpos de /appointments (docs/contratos/api-rest.md §4). */
public final class AppointmentDtos {

    static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private AppointmentDtos() {
    }

    /** Nunca lleva correo ni teléfono del cliente: solo nombre y apellido (spec F3, tarea 3.21). */
    public record AppointmentResponse(String id, String clientId, String clientName, String serviceId,
                                      String serviceName, String durationLabel, LocalDate date, String time,
                                      String status, String notes, String paymentStatus, String paymentMethod) {

        public static AppointmentResponse from(Appointment a) {
            String clientName = (a.getClient().getFirstName() + " " + a.getClient().getLastName()).trim();
            return new AppointmentResponse(a.getId(), a.getClient().getId(), clientName, a.getService().getId(),
                a.getService().getName(), a.getService().getDurationLabel(), a.getDate(), format(a.getTime()),
                a.getStatus().name(), a.getNotes(), a.getPaymentStatus().name(),
                a.getPaymentMethod() == null ? null : a.getPaymentMethod().name());
        }
    }

    public record CreateAppointmentRequest(
        @NotBlank(message = "Faltan datos requeridos de la reserva.") String serviceId,
        @NotNull(message = "Faltan datos requeridos de la reserva.") LocalDate date,
        @NotNull(message = "Faltan datos requeridos de la reserva.")
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "La hora debe tener el formato HH:mm.") String time,
        @Size(max = 500, message = "Las notas no pueden superar 500 caracteres.") String notes
    ) {
    }

    public record StatusRequest(@NotNull(message = "Indica el nuevo estado de la cita.") Status status) {
    }

    static String format(LocalTime time) {
        return time.format(HH_MM);
    }
}
