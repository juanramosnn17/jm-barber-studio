package com.jmbarber.api.expenses;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;

/** Cuerpos de /expenses (docs/contratos/api-rest.md §6). */
public final class ExpenseDtos {

    static final String REQUIRED = "Por favor ingresa fecha, concepto y un importe mayor a cero.";
    static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private ExpenseDtos() {
    }

    public record ExpenseResponse(String id, LocalDate date, String time, String category, String concept,
                                  long amount, String paymentMethod, String status, String reference,
                                  String voidReason, Instant voidedAt) {

        public static ExpenseResponse from(Expense e) {
            return new ExpenseResponse(e.getId(), e.getDate(), e.getTime().format(HH_MM), e.getCategory().name(),
                e.getConcept(), e.getAmount().longValue(), e.getPaymentMethod().name(), e.getStatus().name(),
                e.getReference(), e.getVoidReason(), e.getVoidedAt());
        }
    }

    public record ExpenseRequest(
        @NotNull(message = REQUIRED) LocalDate date,
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "La hora debe tener el formato HH:mm.") String time,
        Expense.Category category,
        @NotBlank(message = REQUIRED) @Size(max = 200, message = "El concepto no puede superar 200 caracteres.")
        String concept,
        @NotNull(message = REQUIRED) BigDecimal amount,
        PaymentMethod paymentMethod,
        @Size(max = 120, message = "La referencia no puede superar 120 caracteres.") String reference
    ) {
    }

    public record VoidRequest(
        @NotBlank(message = "Escribe el motivo de la anulación.")
        @Size(max = 300, message = "El motivo no puede superar 300 caracteres.") String reason
    ) {
    }
}
