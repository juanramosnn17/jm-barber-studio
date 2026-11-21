package com.jmbarber.api.appointments;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;
import com.jmbarber.api.appointments.AppointmentEnums.PaymentStatus;
import com.jmbarber.api.appointments.AppointmentEnums.Status;
import com.jmbarber.api.services.BarberService;
import com.jmbarber.api.users.User;

/**
 * Tabla `appointments` (V1). La columna generada `active_slot` no se mapea:
 * la calcula MySQL y su índice UNIQUE impide dos citas activas en el mismo turno.
 */
@Entity
@Table(name = "appointments")
public class Appointment {

    @Id
    @Column(columnDefinition = "char(36)")
    private String id;

    /** null cuando el cliente fue eliminado (V3: ON DELETE SET NULL); la cita se conserva en contabilidad. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", columnDefinition = "char(36)")
    private User client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id", nullable = false, columnDefinition = "char(36)")
    private BarberService service;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime time;

    /** Fin de la cita congelado al reservar: time + duración del servicio (V3, tarea 4.12). */
    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false,
        columnDefinition = "enum('PENDIENTE','CONFIRMADA','EN_CURSO','COMPLETADA','CANCELADA')")
    private Status status;

    @Column(length = 500)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false,
        columnDefinition = "enum('PENDIENTE','PAGADO','REEMBOLSADO','ANULADO')")
    private PaymentStatus paymentStatus = PaymentStatus.PENDIENTE;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", columnDefinition = "enum('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI_DAVIPLATA')")
    private PaymentMethod paymentMethod;

    @Column(name = "gross_amount", precision = 10, scale = 2)
    private BigDecimal grossAmount;

    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "refund_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Column(name = "tip_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal tipAmount = BigDecimal.ZERO;

    @Column(name = "reserve_amount", precision = 10, scale = 2)
    private BigDecimal reserveAmount;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected Appointment() {
        // requerido por JPA
    }

    /**
     * Reserva hecha por el cliente: queda CONFIRMADA (spec F2). El fin lo decide el servidor
     * (AppointmentService ya validó que [time, endTime) cabe en el horario del día).
     */
    public static Appointment book(User client, BarberService service, LocalDate date, LocalTime time,
                                   LocalTime endTime, String notes) {
        Appointment a = new Appointment();
        a.id = UUID.randomUUID().toString();
        a.client = client;
        a.service = service;
        a.date = date;
        a.time = time;
        a.endTime = endTime;
        a.notes = notes;
        a.status = Status.CONFIRMADA;
        return a;
    }

    /** Cambio de estado con sus efectos en el pago y la reserva (contrato §4). */
    public void changeStatus(Status newStatus, Instant now) {
        Status previous = this.status;
        this.status = newStatus;
        if (newStatus == Status.COMPLETADA && previous != Status.COMPLETADA) {
            paymentStatus = PaymentStatus.PAGADO;
            paymentMethod = PaymentMethod.EFECTIVO;
            grossAmount = service.getPrice();
            reserveAmount = service.getReserveAmount(); // se fija hoy; cambios futuros no la afectan
            paidAt = now;
        } else if (newStatus == Status.CANCELADA) {
            paymentStatus = PaymentStatus.ANULADO;
        } else if (newStatus != Status.COMPLETADA) {
            // vuelve a un estado activo: sin cobro, reserva ni ajustes
            paymentStatus = PaymentStatus.PENDIENTE;
            paymentMethod = null;
            grossAmount = null;
            reserveAmount = null;
            paidAt = null;
            discountAmount = BigDecimal.ZERO;
            refundAmount = BigDecimal.ZERO;
            tipAmount = BigDecimal.ZERO;
        }
    }

    /** Ajuste del pago de una cita completada (tareas 3.26 y 3.29). Las validaciones van en el servicio. */
    public void adjustPayment(PaymentMethod method, BigDecimal discount, BigDecimal refund, BigDecimal tip) {
        this.paymentMethod = method;
        this.discountAmount = discount;
        this.refundAmount = refund;
        this.tipAmount = tip;
        this.paymentStatus = refund.signum() > 0 ? PaymentStatus.REEMBOLSADO : PaymentStatus.PAGADO;
    }

    public String getId() { return id; }
    public User getClient() { return client; }
    public BarberService getService() { return service; }
    public LocalDate getDate() { return date; }
    public LocalTime getTime() { return time; }
    public LocalTime getEndTime() { return endTime; }
    public Status getStatus() { return status; }
    public String getNotes() { return notes; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public BigDecimal getGrossAmount() { return grossAmount; }
    public BigDecimal getReserveAmount() { return reserveAmount; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public BigDecimal getRefundAmount() { return refundAmount; }
    public BigDecimal getTipAmount() { return tipAmount; }
    public Instant getPaidAt() { return paidAt; }
}
