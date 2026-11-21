package com.jmbarber.api.expenses;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;
import com.jmbarber.api.common.ApiException;
import com.jmbarber.api.expenses.ExpenseDtos.ExpenseRequest;
import com.jmbarber.api.expenses.ExpenseDtos.ExpenseResponse;

/** Gastos operativos (spec F5, tareas 3.23–3.25 y 3.29). Solo ADMIN (lo exige el controlador). */
@Service
public class ExpenseService {

    static final String VOIDED_CANNOT_EDIT = "Un gasto anulado no se puede editar.";
    static final String ALREADY_VOIDED = "Este gasto ya está anulado.";
    static final String NOT_FOUND = "No se encontró el gasto.";

    private final ExpenseRepository expenses;
    private final Clock clock;

    public ExpenseService(ExpenseRepository expenses, Clock clock) {
        this.expenses = expenses;
        this.clock = clock;
    }

    @Transactional
    public ExpenseResponse create(ExpenseRequest req) {
        Expense expense = Expense.register();
        apply(expense, req);
        return ExpenseResponse.from(expenses.save(expense));
    }

    @Transactional
    public ExpenseResponse update(String id, ExpenseRequest req) {
        Expense expense = find(id);
        if (expense.getStatus() == Expense.Status.ANULADO) {
            throw ApiException.conflict("EXPENSE_VOIDED", VOIDED_CANNOT_EDIT);
        }
        apply(expense, req);
        return ExpenseResponse.from(expense);
    }

    @Transactional
    public ExpenseResponse voidExpense(String id, String reason) {
        Expense expense = find(id);
        if (expense.getStatus() == Expense.Status.ANULADO) {
            throw ApiException.conflict("EXPENSE_VOIDED", ALREADY_VOIDED);
        }
        expense.voidWith(reason.trim(), Instant.now(clock));
        return ExpenseResponse.from(expense);
    }

    @Transactional
    public void delete(String id) {
        expenses.delete(find(id));
    }

    private void apply(Expense expense, ExpenseRequest req) {
        BigDecimal amount = req.amount().setScale(0, RoundingMode.HALF_UP); // pesos enteros
        if (amount.signum() <= 0) {
            throw ApiException.badRequest(ExpenseDtos.REQUIRED);
        }
        LocalTime time = req.time() == null || req.time().isBlank()
            ? LocalTime.NOON : LocalTime.parse(req.time(), ExpenseDtos.HH_MM);
        expense.setData(req.date(), time,
            req.category() == null ? Expense.Category.OTROS : req.category(),
            req.concept().trim(), amount,
            req.paymentMethod() == null ? PaymentMethod.TRANSFERENCIA : req.paymentMethod(),
            req.reference() == null || req.reference().isBlank() ? null : req.reference().trim());
    }

    private Expense find(String id) {
        return expenses.findById(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }
}
