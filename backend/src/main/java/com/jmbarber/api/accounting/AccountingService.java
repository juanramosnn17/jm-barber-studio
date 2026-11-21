package com.jmbarber.api.accounting;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.accounting.AccountingDtos.ReportResponse;
import com.jmbarber.api.accounting.AccountingDtos.Summary;
import com.jmbarber.api.accounting.AccountingDtos.TransactionRow;
import com.jmbarber.api.accounting.AccountingDtos.TransactionsPage;
import com.jmbarber.api.appointments.Appointment;
import com.jmbarber.api.appointments.AppointmentRepository;
import com.jmbarber.api.expenses.Expense;
import com.jmbarber.api.expenses.ExpenseRepository;

/**
 * Motor contable con el modelo de reserva (spec F5, tarea 3.27). Traduce las reglas de
 * lib/accounting/profit-report.calculations.ts: sin comisiones; cada servicio cobrado aparta
 * una reserva fija que paga los gastos; las propinas van aparte.
 */
@Service
public class AccountingService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final AppointmentRepository appointments;
    private final ExpenseRepository expenses;
    private final Clock clock;

    public AccountingService(AppointmentRepository appointments, ExpenseRepository expenses, Clock clock) {
        this.appointments = appointments;
        this.expenses = expenses;
        this.clock = clock;
    }

    /** Resumen y todas las filas del periodo (el CSV las usa completas; el JSON las pagina). */
    public record FullReport(ReportPeriod period, Summary summary, List<TransactionRow> rows) {
    }

    public ReportPeriod period(String key, LocalDate start, LocalDate end) {
        return ReportPeriod.resolve(key, start, end, LocalDate.now(clock));
    }

    @Transactional(readOnly = true)
    public ReportResponse report(ReportPeriod period, int page, int size) {
        FullReport full = build(period);
        int safeSize = Math.min(100, Math.max(1, size));
        int total = full.rows().size();
        int totalPages = Math.max(1, (total + safeSize - 1) / safeSize);
        int safePage = Math.min(Math.max(1, page), totalPages);
        int from = (safePage - 1) * safeSize;
        List<TransactionRow> rows = full.rows().subList(from, Math.min(total, from + safeSize));
        return new ReportResponse(period, full.summary(), new TransactionsPage(rows, total, safePage, totalPages));
    }

    @Transactional(readOnly = true)
    public FullReport build(ReportPeriod period) {
        long income = 0;
        long reserve = 0;
        long tips = 0;
        int servicesCount = 0;
        List<TransactionRow> rows = new ArrayList<>();

        for (Appointment a : appointments.findCollectedBetween(period.startDate(), period.endDate())) {
            BigDecimal grossValue = a.getGrossAmount() != null ? a.getGrossAmount() : a.getService().getPrice();
            long gross = pesos(grossValue);
            long net = gross - pesos(a.getDiscountAmount()) - pesos(a.getRefundAmount());
            long tip = pesos(a.getTipAmount());

            long appointmentReserve = 0;
            if (net > 0) {
                servicesCount++;
                BigDecimal fixed = a.getReserveAmount() != null ? a.getReserveAmount() : a.getService().getReserveAmount();
                appointmentReserve = Math.min(pesos(fixed), net); // la reserva nunca supera lo cobrado
            }
            income += net;
            reserve += appointmentReserve;
            tips += tip;

            String clientName = (a.getClient().getFirstName() + " " + a.getClient().getLastName()).trim();
            rows.add(new TransactionRow(a.getId(), "INGRESO", a.getDate(), a.getTime().format(HH_MM),
                a.getService().getName(), clientName,
                a.getPaymentMethod() == null ? null : a.getPaymentMethod().name(),
                net, 0, tip, a.getPaymentStatus().name()));
        }

        long expenseTotal = 0;
        for (Expense e : expenses.findByDateBetween(period.startDate(), period.endDate())) {
            long amount = pesos(e.getAmount());
            if (e.getStatus() == Expense.Status.REGISTRADO) {
                expenseTotal += amount;
            }
            rows.add(new TransactionRow(e.getId(), "GASTO", e.getDate(), e.getTime().format(HH_MM),
                e.getConcept(), null, e.getPaymentMethod().name(), 0, amount, 0, e.getStatus().name()));
        }

        rows.sort(Comparator.comparing(TransactionRow::date).thenComparing(TransactionRow::time).reversed()
            .thenComparing(TransactionRow::id));

        Long averageTicket = servicesCount > 0 ? Math.round((double) income / servicesCount) : null;
        Summary summary = new Summary(income, income - reserve, reserve, expenseTotal, reserve - expenseTotal,
            servicesCount, averageTicket, tips);
        return new FullReport(period, summary, rows);
    }

    private static long pesos(BigDecimal value) {
        return value == null ? 0 : value.setScale(0, RoundingMode.HALF_UP).longValue();
    }
}
