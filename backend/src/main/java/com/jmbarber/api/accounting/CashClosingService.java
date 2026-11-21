package com.jmbarber.api.accounting;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.appointments.Appointment;
import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;
import com.jmbarber.api.appointments.AppointmentRepository;
import com.jmbarber.api.expenses.Expense;
import com.jmbarber.api.expenses.ExpenseRepository;
import com.jmbarber.api.sales.ProductSale;
import com.jmbarber.api.sales.ProductSaleRepository;

/**
 * Cierre de caja del día (tarea 3.31, spec F5): lo cobrado por cada método de pago, las propinas,
 * los gastos y el efectivo que debe haber en caja. Supuesto en docs/decisiones.md: las propinas en
 * efectivo quedan en la caja porque el dueño es el único barbero.
 */
@Service
public class CashClosingService {

    /** Orden fijo en que se muestran los métodos. */
    private static final List<PaymentMethod> ORDER = List.of(
        PaymentMethod.EFECTIVO, PaymentMethod.NEQUI_DAVIPLATA, PaymentMethod.TRANSFERENCIA, PaymentMethod.TARJETA);

    public record MethodLine(String paymentMethod, long income, long tips, long expenses, long balance) {
    }

    public record Totals(long income, long tips, long expenses) {
    }

    public record CashClosing(LocalDate date, List<MethodLine> methods, Totals totals, long expectedCash) {
    }

    private final AppointmentRepository appointments;
    private final ProductSaleRepository sales;
    private final ExpenseRepository expenses;
    private final Clock clock;

    public CashClosingService(AppointmentRepository appointments, ProductSaleRepository sales,
                              ExpenseRepository expenses, Clock clock) {
        this.appointments = appointments;
        this.sales = sales;
        this.expenses = expenses;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CashClosing close(LocalDate requested) {
        LocalDate date = requested != null ? requested : LocalDate.now(clock);
        Map<PaymentMethod, long[]> acc = new EnumMap<>(PaymentMethod.class); // [ingresos, propinas, gastos]
        ORDER.forEach(m -> acc.put(m, new long[3]));

        for (Appointment a : appointments.findCollectedBetween(date, date)) {
            long[] line = acc.get(methodOf(a.getPaymentMethod()));
            line[0] += AccountingService.netOf(a);
            line[1] += AccountingService.pesos(a.getTipAmount());
        }
        for (ProductSale s : sales.findByDateBetween(date, date)) {
            if (s.getStatus() == ProductSale.Status.REGISTRADO) {
                acc.get(s.getPaymentMethod())[0] += AccountingService.pesos(s.getAmount());
            }
        }
        for (Expense e : expenses.findByDateBetween(date, date)) {
            if (e.getStatus() == Expense.Status.REGISTRADO) {
                acc.get(e.getPaymentMethod())[2] += AccountingService.pesos(e.getAmount());
            }
        }

        long income = 0;
        long tips = 0;
        long spent = 0;
        List<MethodLine> lines = new ArrayList<>();
        for (PaymentMethod m : ORDER) {
            long[] v = acc.get(m);
            lines.add(new MethodLine(m.name(), v[0], v[1], v[2], v[0] + v[1] - v[2]));
            income += v[0];
            tips += v[1];
            spent += v[2];
        }
        return new CashClosing(date, lines, new Totals(income, tips, spent), lines.get(0).balance());
    }

    /** Una cita completada siempre queda con método (efectivo por defecto al completarla). */
    private static PaymentMethod methodOf(PaymentMethod method) {
        return method != null ? method : PaymentMethod.EFECTIVO;
    }
}
