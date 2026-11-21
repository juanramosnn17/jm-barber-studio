package com.jmbarber.api.sales;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;

/** Cuerpos de /product-sales (docs/contratos/api-rest.md §6b). */
public final class ProductSaleDtos {

    static final String REQUIRED = "Por favor ingresa fecha, producto y un importe mayor a cero.";
    static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private ProductSaleDtos() {
    }

    public record ProductSaleResponse(String id, LocalDate date, String time, String concept, long amount,
                                      String paymentMethod, String status, String voidReason, Instant voidedAt) {

        public static ProductSaleResponse from(ProductSale s) {
            return new ProductSaleResponse(s.getId(), s.getDate(), s.getTime().format(HH_MM), s.getConcept(),
                s.getAmount().longValue(), s.getPaymentMethod().name(), s.getStatus().name(), s.getVoidReason(),
                s.getVoidedAt());
        }
    }

    public record ProductSaleRequest(
        @NotNull(message = REQUIRED) LocalDate date,
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "La hora debe tener el formato HH:mm.") String time,
        @NotBlank(message = REQUIRED) @Size(max = 200, message = "El producto no puede superar 200 caracteres.")
        String concept,
        @NotNull(message = REQUIRED) BigDecimal amount,
        PaymentMethod paymentMethod
    ) {
    }
}
