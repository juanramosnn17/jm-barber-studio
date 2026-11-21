package com.jmbarber.api.expenses;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;

/** Tabla `expenses` (V1): gastos que se pagan con la reserva del negocio (spec F5). */
@Entity
@Table(name = "expenses")
public class Expense {

    public enum Category {
        ARRIENDO, SERVICIOS_PUBLICOS, NOMINA_ADMINISTRATIVA, INSUMOS_GENERALES,
        COMPRA_INSUMOS_PRODUCTOS, PUBLICIDAD, MANTENIMIENTO, OTROS
    }

    public enum Status { REGISTRADO, ANULADO }

    @Id
    @Column(columnDefinition = "char(36)")
    private String id;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime time;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('ARRIENDO','SERVICIOS_PUBLICOS','NOMINA_ADMINISTRATIVA',"
        + "'INSUMOS_GENERALES','COMPRA_INSUMOS_PRODUCTOS','PUBLICIDAD','MANTENIMIENTO','OTROS')")
    private Category category;

    @Column(nullable = false, length = 200)
    private String concept;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false,
        columnDefinition = "enum('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI_DAVIPLATA')")
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('REGISTRADO','ANULADO')")
    private Status status = Status.REGISTRADO;

    @Column(length = 120)
    private String reference;

    @Column(length = 500)
    private String notes;

    @Column(name = "void_reason", length = 300)
    private String voidReason;

    @Column(name = "voided_at")
    private Instant voidedAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected Expense() {
        // requerido por JPA
    }

    public static Expense register() {
        Expense e = new Expense();
        e.id = UUID.randomUUID().toString();
        e.status = Status.REGISTRADO;
        return e;
    }

    public void setData(LocalDate date, LocalTime time, Category category, String concept, BigDecimal amount,
                        PaymentMethod paymentMethod, String reference) {
        this.date = date;
        this.time = time;
        this.category = category;
        this.concept = concept;
        this.amount = amount;
        this.paymentMethod = paymentMethod;
        this.reference = reference;
    }

    public void voidWith(String reason, Instant now) {
        this.status = Status.ANULADO;
        this.voidReason = reason;
        this.voidedAt = now;
    }

    public String getId() { return id; }
    public LocalDate getDate() { return date; }
    public LocalTime getTime() { return time; }
    public Category getCategory() { return category; }
    public String getConcept() { return concept; }
    public BigDecimal getAmount() { return amount; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public Status getStatus() { return status; }
    public String getReference() { return reference; }
    public String getVoidReason() { return voidReason; }
    public Instant getVoidedAt() { return voidedAt; }
}
