package com.jmbarber.api.expenses;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.jmbarber.api.expenses.ExpenseDtos.ExpenseRequest;
import com.jmbarber.api.expenses.ExpenseDtos.ExpenseResponse;
import com.jmbarber.api.expenses.ExpenseDtos.VoidRequest;

/** /api/v1/expenses (docs/contratos/api-rest.md §6). Todo es solo para ADMIN. */
@RestController
@RequestMapping("/api/v1/expenses")
@PreAuthorize("hasRole('ADMIN')")
public class ExpensesController {

    private final ExpenseService service;

    public ExpensesController(ExpenseService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse create(@Valid @RequestBody ExpenseRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public ExpenseResponse update(@PathVariable String id, @Valid @RequestBody ExpenseRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/void")
    public ExpenseResponse voidExpense(@PathVariable String id, @Valid @RequestBody VoidRequest request) {
        return service.voidExpense(id, request.reason());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }
}
