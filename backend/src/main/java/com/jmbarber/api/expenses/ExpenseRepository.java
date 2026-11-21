package com.jmbarber.api.expenses;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, String> {

    /** Todos los gastos del periodo, también los anulados (el reporte los muestra sin sumarlos). */
    List<Expense> findByDateBetween(LocalDate start, LocalDate end);
}
