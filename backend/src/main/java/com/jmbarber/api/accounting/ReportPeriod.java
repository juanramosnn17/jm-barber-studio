package com.jmbarber.api.accounting;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;

import com.jmbarber.api.common.ApiException;

/** Periodo del reporte contable (spec F5, mismas reglas que lib/accounting/profit-report.validation.ts). */
public record ReportPeriod(String key, LocalDate startDate, LocalDate endDate) {

    static final int MAX_DAYS = 366;
    static final String INVALID = "Período no válido. Usa today, this_week, this_month, last_month o custom.";
    static final String CUSTOM_REQUIRED = "Para un período personalizado indica fecha de inicio y de fin.";
    static final String CUSTOM_ORDER = "La fecha de inicio no puede ser posterior a la fecha de fin.";
    static final String CUSTOM_TOO_LONG = "El rango seleccionado supera el límite de " + MAX_DAYS + " días.";

    /** @param today fecha de hoy en la hora de Colombia */
    public static ReportPeriod resolve(String key, LocalDate start, LocalDate end, LocalDate today) {
        String k = key == null || key.isBlank() ? "this_month" : key.trim();
        return switch (k) {
            case "today" -> new ReportPeriod(k, today, today);
            case "this_week" -> {
                LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                yield new ReportPeriod(k, monday, monday.plusDays(6));
            }
            case "this_month" -> new ReportPeriod(k, today.withDayOfMonth(1),
                today.with(TemporalAdjusters.lastDayOfMonth()));
            case "last_month" -> {
                LocalDate first = today.minusMonths(1).withDayOfMonth(1);
                yield new ReportPeriod(k, first, first.with(TemporalAdjusters.lastDayOfMonth()));
            }
            case "custom" -> custom(start, end);
            default -> throw ApiException.badRequest(INVALID);
        };
    }

    private static ReportPeriod custom(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            throw ApiException.badRequest(CUSTOM_REQUIRED);
        }
        if (start.isAfter(end)) {
            throw ApiException.badRequest(CUSTOM_ORDER);
        }
        if (ChronoUnit.DAYS.between(start, end) + 1 > MAX_DAYS) {
            throw ApiException.badRequest(CUSTOM_TOO_LONG);
        }
        return new ReportPeriod("custom", start, end);
    }
}
