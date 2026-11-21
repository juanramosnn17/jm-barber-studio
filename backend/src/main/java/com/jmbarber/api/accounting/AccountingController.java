package com.jmbarber.api.accounting;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.jmbarber.api.accounting.AccountingDtos.ReportResponse;

/** /api/v1/accounting (docs/contratos/api-rest.md §7). Datos financieros: solo ADMIN. */
@RestController
@RequestMapping("/api/v1/accounting")
@PreAuthorize("hasRole('ADMIN')")
public class AccountingController {

    private final AccountingService service;
    private final CashClosingService cashClosing;

    public AccountingController(AccountingService service, CashClosingService cashClosing) {
        this.service = service;
        this.cashClosing = cashClosing;
    }

    /** Cierre de caja del día (tarea 3.31). Sin fecha, es el de hoy en Colombia. */
    @GetMapping("/cash-closing")
    public ResponseEntity<CashClosingService.CashClosing> cashClosing(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(cashClosing.close(date));
    }

    @GetMapping("/report")
    public ResponseEntity<ReportResponse> report(
        @RequestParam(required = false) String period,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "15") int size) {
        ReportResponse body = service.report(service.period(period, startDate, endDate), page, size);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    @GetMapping("/report.csv")
    public ResponseEntity<byte[]> csv(
        @RequestParam(required = false) String period,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        ReportPeriod resolved = service.period(period, startDate, endDate);
        return ResponseEntity.ok()
            .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(CsvExporter.filename(resolved)).build().toString())
            .cacheControl(CacheControl.noStore())
            .body(CsvExporter.export(service.build(resolved)));
    }
}
