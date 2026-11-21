package com.jmbarber.api.appointments;

/** Valores de los ENUM de la tabla `appointments` (V1). */
public final class AppointmentEnums {

    private AppointmentEnums() {
    }

    public enum Status { PENDIENTE, CONFIRMADA, EN_CURSO, COMPLETADA, CANCELADA }

    public enum PaymentStatus { PENDIENTE, PAGADO, REEMBOLSADO, ANULADO }

    public enum PaymentMethod { EFECTIVO, TRANSFERENCIA, TARJETA, NEQUI_DAVIPLATA }
}
