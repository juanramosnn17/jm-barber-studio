/* =====================================================================
   EXPORTACIÓN SEGURA A CSV DEL REPORTE DE GANANCIAS
   (lib/accounting/profit-report.export.ts)
   ===================================================================== */

import type {
  AccountingTransactionRow,
  ProfitReportData,
} from "./profit-report.types";
import {
  EXPENSE_CATEGORY_LABELS,
  MAX_EXPORT_ROWS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "./profit-report.validation";

const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r]/;

/**
 * Sanitiza el contenido de una celda CSV para impedir inyección de fórmulas
 * ejecutables en hojas de cálculo (CSV Injection: =, +, -, @, Tab, CR)
 * y escapa comillas dobles según RFC 4180.
 */
export function sanitizeCsvCell(
  rawValue: string | number | null | undefined,
  options: { isNumericLiteral?: boolean } = {}
): string {
  if (rawValue === null || rawValue === undefined) return '""';
  let str = String(rawValue);

  const isSafeNegativeNumber =
    options.isNumericLiteral && /^-?\d+(\.\d+)?$/.test(str);

  if (!isSafeNegativeNumber && FORMULA_TRIGGER_REGEX.test(str.trimStart())) {
    str = `'${str}`;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function csvRow(
  cells: Array<{ value: string | number | null | undefined; isNumeric?: boolean }>
): string {
  return cells
    .map((c) => sanitizeCsvCell(c.value, { isNumericLiteral: c.isNumeric }))
    .join(",");
}

/**
 * Construye el contenido CSV completo y auditable a partir de un reporte calculado
 * y la lista completa de movimientos filtrados.
 */
export function generateProfitReportCsv(
  report: ProfitReportData,
  allTransactions: AccountingTransactionRow[]
):
  | { ok: true; csvContent: string; filename: string }
  | { ok: false; code: "EXPORT_LIMIT_EXCEEDED"; message: string } {
  if (allTransactions.length > MAX_EXPORT_ROWS) {
    return {
      ok: false,
      code: "EXPORT_LIMIT_EXCEEDED",
      message: `El reporte contiene ${allTransactions.length} movimientos, superando el límite seguro de exportación directa (${MAX_EXPORT_ROWS} registros). Por favor acota el rango de fechas o aplica filtros adicionales.`,
    };
  }

  const { period, appliedFilters, summary, completeness } = report;
  const lines: string[] = [];

  // 1. Encabezado y metadatos del reporte
  lines.push(
    csvRow([
      { value: "REPORTE DETALLADO DE CONTABILIDAD Y GANANCIAS — JM BARBER STUDIO" },
    ])
  );
  lines.push(
    csvRow([
      { value: "Fecha y hora de generación" },
      { value: report.generatedAt },
    ])
  );
  lines.push(
    csvRow([
      { value: "Periodo consultado" },
      { value: `${period.startDate} a ${period.endDate} (${period.daysCount} días)` },
    ])
  );
  lines.push(
    csvRow([
      { value: "Periodo comparativo anterior" },
      { value: `${period.previousStartDate} a ${period.previousEndDate}` },
    ])
  );
  lines.push(
    csvRow([
      { value: "Zona horaria" },
      { value: period.timezone },
    ])
  );
  lines.push(
    csvRow([
      { value: "Moneda" },
      { value: period.currency },
    ])
  );
  lines.push(
    csvRow([
      { value: "Estado de completitud contable" },
      {
        value: completeness.isComplete
          ? "COMPLETO"
          : `PARCIAL (Faltan: ${completeness.missingComponents.join(", ")})`,
      },
    ])
  );

  // 2. Filtros aplicados
  lines.push("");
  lines.push(csvRow([{ value: "FILTROS APLICADOS" }]));
  lines.push(
    csvRow([
      { value: "Barbero" },
      { value: appliedFilters.barberId || "Todos" },
    ])
  );
  lines.push(
    csvRow([
      { value: "Servicio" },
      { value: appliedFilters.serviceId || "Todos" },
    ])
  );
  lines.push(
    csvRow([
      { value: "Método de pago" },
      {
        value: appliedFilters.paymentMethod
          ? PAYMENT_METHOD_LABELS[appliedFilters.paymentMethod]
          : "Todos",
      },
    ])
  );
  lines.push(
    csvRow([
      { value: "Estado de pago" },
      {
        value: appliedFilters.paymentStatus
          ? PAYMENT_STATUS_LABELS[appliedFilters.paymentStatus]
          : "Todos",
      },
    ])
  );
  lines.push(
    csvRow([
      { value: "Categoría de gasto" },
      {
        value: appliedFilters.expenseCategoryId
          ? EXPENSE_CATEGORY_LABELS[appliedFilters.expenseCategoryId]
          : "Todas",
      },
    ])
  );

  // 3. Indicadores principales
  lines.push("");
  lines.push(
    csvRow([
      { value: "INDICADORES PRINCIPALES" },
      { value: `IMPORTE (${period.currency})` },
    ])
  );
  lines.push(
    csvRow([
      { value: "Ingresos brutos" },
      { value: summary.grossRevenue, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Descuentos" },
      { value: summary.discounts, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Reembolsos o devoluciones" },
      { value: summary.refunds, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Ingresos netos" },
      { value: summary.netRevenue, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Costos directos totales (Insumos + Comisiones)" },
      { value: summary.directCosts, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "  - Insumos directos" },
      { value: summary.supplyCosts, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "  - Comisiones de barberos" },
      { value: summary.commissions, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Ganancia bruta" },
      { value: summary.grossProfit, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Gastos operativos" },
      { value: summary.operatingExpenses, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Ganancia neta" },
      {
        value:
          summary.netProfit !== null
            ? summary.netProfit
            : `${summary.partialNetProfit} (PARCIAL)`,
        isNumeric: summary.netProfit !== null,
      },
    ])
  );
  lines.push(
    csvRow([
      { value: "Margen bruto (%)" },
      {
        value:
          summary.grossMarginPercentage !== null
            ? `${summary.grossMarginPercentage}%`
            : "N/A",
      },
    ])
  );
  lines.push(
    csvRow([
      { value: "Margen neto (%)" },
      {
        value:
          summary.netMarginPercentage !== null
            ? `${summary.netMarginPercentage}%`
            : "N/A",
      },
    ])
  );
  lines.push(
    csvRow([
      { value: "Servicios pagados" },
      { value: summary.paidServicesCount, isNumeric: true },
    ])
  );
  lines.push(
    csvRow([
      { value: "Ticket promedio" },
      {
        value: summary.averageTicket !== null ? summary.averageTicket : "N/A",
        isNumeric: summary.averageTicket !== null,
      },
    ])
  );
  lines.push(
    csvRow([
      { value: "Propinas recaudadas para barberos (excluidas de ingresos)" },
      { value: summary.tipsExcluded, isNumeric: true },
    ])
  );

  // 4. Detalle de movimientos
  lines.push("");
  lines.push(csvRow([{ value: "DETALLE DE MOVIMIENTOS AUDITABLES" }]));
  lines.push(
    csvRow([
      { value: "Fecha y Hora" },
      { value: "Tipo de Movimiento" },
      { value: "Referencia" },
      { value: "ID Relacionado" },
      { value: "Concepto" },
      { value: "Cliente (Anonimizado)" },
      { value: "Barbero" },
      { value: "Método de Pago" },
      { value: "Ingreso Bruto" },
      { value: "Descuento" },
      { value: "Reembolso" },
      { value: "Ingreso Neto" },
      { value: "Costo Directo" },
      { value: "Gasto Operativo" },
      { value: "Propina Barbero" },
      { value: "Estado" },
      { value: "Contabilizado en Totales" },
    ])
  );

  for (const row of allTransactions) {
    lines.push(
      csvRow([
        { value: row.dateTime },
        { value: row.typeLabel },
        { value: row.reference },
        { value: row.relatedId },
        { value: row.concept },
        { value: row.clientAnonymized ?? "-" },
        { value: row.barberName ?? "-" },
        { value: row.paymentMethodLabel },
        { value: row.grossIncome, isNumeric: true },
        { value: row.discountAmount, isNumeric: true },
        { value: row.refundAmount, isNumeric: true },
        { value: row.netIncome, isNumeric: true },
        { value: row.directCostAmount, isNumeric: true },
        { value: row.operatingExpenseAmount, isNumeric: true },
        { value: row.tipAmount, isNumeric: true },
        { value: row.statusLabel },
        { value: row.isCountedInTotals ? "SÍ" : "NO" },
      ])
    );
  }

  // 5. Fila de totales del conjunto filtrado
  lines.push(
    csvRow([
      { value: "TOTALES DEL PERIODO FILTRADO" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: `${summary.paidServicesCount} servicios pagados` },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: summary.grossRevenue, isNumeric: true },
      { value: summary.discounts, isNumeric: true },
      { value: summary.refunds, isNumeric: true },
      { value: summary.netRevenue, isNumeric: true },
      { value: summary.directCosts, isNumeric: true },
      { value: summary.operatingExpenses, isNumeric: true },
      { value: summary.tipsExcluded, isNumeric: true },
      { value: `Ganancia Neta: ${summary.netProfit ?? summary.partialNetProfit}` },
      { value: "" },
    ])
  );

  // BOM UTF-8 (\uFEFF) para correcta visualización de tildes en Excel
  const csvContent = "\uFEFF" + lines.join("\r\n");
  const filename = `reporte-ganancias-${period.startDate}-a-${period.endDate}.csv`;

  return { ok: true, csvContent, filename };
}
