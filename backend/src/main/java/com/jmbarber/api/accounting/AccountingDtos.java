package com.jmbarber.api.accounting;

import java.time.LocalDate;
import java.util.List;

/** Respuesta de /accounting/report (docs/contratos/api-rest.md §7). Dinero en COP enteros. */
public final class AccountingDtos {

    private AccountingDtos() {
    }

    /** {@code income} ya incluye {@code productSales} (tarea 3.30). */
    public record Summary(long income, long productSales, long yourProfit, long businessReserve, long expenses, long reserveBalance,
                          int servicesCount, Long averageTicket, long tips) {
    }

    public record TransactionRow(String id, String type, LocalDate date, String time, String concept,
                                 String clientName, String paymentMethod, long income, long expense, long tip,
                                 String status) {
    }

    public record TransactionsPage(List<TransactionRow> rows, int total, int page, int totalPages) {
    }

    public record ReportResponse(ReportPeriod period, Summary summary, TransactionsPage transactions) {
    }
}
