package com.jmbarber.api.sales;

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

/** Tabla `product_sales` (V2): venta de un producto en la barbería (tarea 3.30). */
@Entity
@Table(name = "product_sales")
public class ProductSale {

    public enum Status { REGISTRADO, ANULADO }

    @Id
    @Column(columnDefinition = "char(36)")
    private String id;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime time;

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

    @Column(name = "void_reason", length = 300)
    private String voidReason;

    @Column(name = "voided_at")
    private Instant voidedAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected ProductSale() {
        // requerido por JPA
    }

    public static ProductSale register(LocalDate date, LocalTime time, String concept, BigDecimal amount,
                                       PaymentMethod paymentMethod) {
        ProductSale s = new ProductSale();
        s.id = UUID.randomUUID().toString();
        s.date = date;
        s.time = time;
        s.concept = concept;
        s.amount = amount;
        s.paymentMethod = paymentMethod;
        s.status = Status.REGISTRADO;
        return s;
    }

    public void voidWith(String reason, Instant now) {
        this.status = Status.ANULADO;
        this.voidReason = reason;
        this.voidedAt = now;
    }

    public String getId() { return id; }
    public LocalDate getDate() { return date; }
    public LocalTime getTime() { return time; }
    public String getConcept() { return concept; }
    public BigDecimal getAmount() { return amount; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public Status getStatus() { return status; }
    public String getVoidReason() { return voidReason; }
    public Instant getVoidedAt() { return voidedAt; }
}
