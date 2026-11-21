package com.jmbarber.api.accounting;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.jmbarber.api.accounting.AccountingDtos.Summary;
import com.jmbarber.api.accounting.AccountingDtos.TransactionRow;

/** CSV del reporte contable, saneado contra inyección de fórmulas (como lib/accounting/profit-report.export.ts). */
public final class CsvExporter {

    private static final Pattern FORMULA_TRIGGER = Pattern.compile("^[=+\\-@\\t\\r]");
    private static final byte[] UTF8_BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    private CsvExporter() {
    }

    public static String filename(ReportPeriod period) {
        return "reporte-contable_" + period.startDate() + "_" + period.endDate() + ".csv";
    }

    public static byte[] export(AccountingService.FullReport report) {
        Summary s = report.summary();
        StringBuilder csv = new StringBuilder();
        line(csv, text("Reporte contable JM Barber Studio"));
        line(csv, text("Desde"), text(report.period().startDate().toString()),
            text("Hasta"), text(report.period().endDate().toString()));
        csv.append("\r\n");
        line(csv, text("Concepto"), text("Valor (COP)"));
        line(csv, text("Ingresos"), number(s.income()));
        line(csv, text("  de ellos, ventas de productos"), number(s.productSales()));
        line(csv, text("Tu ganancia"), number(s.yourProfit()));
        line(csv, text("Reserva del negocio"), number(s.businessReserve()));
        line(csv, text("Gastos"), number(s.expenses()));
        line(csv, text("Saldo de la reserva"), number(s.reserveBalance()));
        line(csv, text("Servicios realizados"), number(s.servicesCount()));
        line(csv, text("Ticket promedio"), s.averageTicket() == null ? text("N/A") : number(s.averageTicket()));
        line(csv, text("Propinas (aparte)"), number(s.tips()));
        csv.append("\r\n");
        line(csv, text("Fecha"), text("Hora"), text("Tipo"), text("Concepto"), text("Cliente"),
            text("Método de pago"), text("Ingreso"), text("Gasto"), text("Propina"), text("Estado"));
        for (TransactionRow r : report.rows()) {
            line(csv, text(r.date().toString()), text(r.time()), text(r.type()), text(r.concept()),
                text(r.clientName()), text(r.paymentMethod()), number(r.income()), number(r.expense()),
                number(r.tip()), text(r.status()));
        }
        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[UTF8_BOM.length + body.length];
        System.arraycopy(UTF8_BOM, 0, out, 0, UTF8_BOM.length);
        System.arraycopy(body, 0, out, UTF8_BOM.length, body.length);
        return out;
    }

    /** Celda de texto: si empieza con = + - @ tab o retorno se antepone ' para que Excel no la ejecute. */
    static String text(String value) {
        if (value == null) {
            return "\"\"";
        }
        String safe = FORMULA_TRIGGER.matcher(value.stripLeading()).find() ? "'" + value : value;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }

    /** Celda numérica: un número (aunque sea negativo, ej. saldo -2000) nunca es una fórmula; no se altera. */
    static String number(long value) {
        return "\"" + value + "\"";
    }

    private static void line(StringBuilder csv, String... cells) {
        csv.append(Stream.of(cells).collect(Collectors.joining(","))).append("\r\n");
    }
}
