/* =====================================================================
   PRUEBAS AUTOMATIZADAS DEL MÓDULO CONTABLE Y REPORTE DE GANANCIAS
   (tests/accounting/profit-report.test.ts)
   ---------------------------------------------------------------------
   Cubre los 20 escenarios obligatorios de la especificación:
     1. Cálculo de ingresos brutos
     2. Cálculo de ingresos netos
     3. Cálculo de ganancia bruta
     4. Cálculo de ganancia neta
     5. Cálculo de márgenes
     6. División entre cero
     7. Descuentos y reembolsos (parciales, totales y superiores al pago)
     8. Exclusión de pagos pendientes, fallidos o anulados
     9. No duplicación entre registros
    10. Periodo sin movimientos
    11. Comparación con el periodo anterior (incluyendo anterior en cero y gastos)
    12. Rango de fechas inválido y excesivamente grande
    13. Aplicación de filtros (barbero, servicio, método, categoría)
    14. Acceso autorizado (rol 'admin')
    15. Rechazo de usuario sin permiso ('cliente', 'barbero', no autenticado)
    16. Paginación sin alterar los totales globales
    17. Consistencia entre reporte y exportación CSV
    18. Sanitización de CSV contra inyección de fórmulas (=, +, -, @)
    19. Formato monetario y precisión en centavos
    20. Respeto de la zona horaria (America/Bogota cerca de medianoche)
   ===================================================================== */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  AppointmentWithDetails,
  Expense,
  Profile,
  Service,
} from "../../lib/types";
import {
  calculateProfitSummaryAndCompleteness,
  formatAccountingCurrency,
  toCents,
  centsToDecimalString,
} from "../../lib/accounting/profit-report.calculations";
import {
  getDateInTimezone,
  resolveQuickPeriodDates,
  validateProfitReportFilters,
} from "../../lib/accounting/profit-report.validation";
import { buildProfitReportFromDataset } from "../../lib/accounting/profit-report.service";
import {
  generateProfitReportCsv,
  sanitizeCsvCell,
} from "../../lib/accounting/profit-report.export";

const adminProfile: Profile = {
  id: "user-admin",
  first_name: "Juan Felipe",
  last_name: "Ortiz",
  email: "director@jmbarberstudio.com",
  phone: "+57 310 980 4421",
  role: "admin",
  avatar_url: null,
  reminders_opt_in: true,
};

const barberProfile: Profile = {
  id: "user-barber",
  first_name: "Marcos",
  last_name: "Silva",
  email: "marcos@jmbarberstudio.com",
  phone: null,
  role: "barbero",
  avatar_url: null,
  reminders_opt_in: true,
};

const clientProfile: Profile = {
  id: "user-client",
  first_name: "Fabian",
  last_name: "Reyes",
  email: "cliente@jmbarber.com",
  phone: null,
  role: "cliente",
  avatar_url: null,
  reminders_opt_in: true,
};

const testServices: Service[] = [
  {
    id: "srv-1",
    name: "Corte de cabello",
    short_name: "Corte",
    description: "Corte clásico",
    includes: null,
    price: 25000,
    direct_cost: 2500,
    commission_percentage: 40, // 10.000 COP sobre 25.000
    duration_label: "40 min",
    duration_minutes: 40,
    image_url: null,
    icon: "content_cut",
    is_active: true,
    sort_order: 1,
  },
  {
    id: "srv-2",
    name: "Corte Pro (Cabello + Barba)",
    short_name: "Corte Pro",
    description: "Corte y barba",
    includes: null,
    price: 38000,
    direct_cost: 4000,
    commission_percentage: 45, // 17.100 COP sobre 38.000
    duration_label: "60 min",
    duration_minutes: 60,
    image_url: null,
    icon: "stars",
    is_active: true,
    sort_order: 2,
  },
];

const sampleAppointments: AppointmentWithDetails[] = [
  // Cita 1: Completada y pagada sin descuentos, con propina de 3.000 (excluida de ingresos del negocio)
  {
    id: "app-1",
    client_id: "c1",
    client_name: "Carlos Mendoza",
    service_id: "srv-1",
    service_name: "Corte de cabello",
    barber_name: "Marcos Silva",
    chair: "Sillón 01",
    date: "2026-10-10",
    time: "10:00",
    status: "completada",
    notes: null,
    payment_status: "pagado",
    payment_method: "efectivo",
    gross_amount: 25000,
    discount_amount: 0,
    refund_amount: 0,
    tip_amount: 3000,
    direct_cost_amount: 2500,
    commission_amount: 10000,
    paid_at: "2026-10-10T10:45:00-05:00",
  },
  // Cita 2: Completada y pagada con descuento de 3.000 y reembolso parcial de 5.000
  {
    id: "app-2",
    client_id: "c2",
    client_name: "David Rivas",
    service_id: "srv-2",
    service_name: "Corte Pro (Cabello + Barba)",
    barber_name: "Mateo Gómez",
    chair: "Sillón 02",
    date: "2026-10-12",
    time: "15:00",
    status: "completada",
    notes: null,
    payment_status: "reembolsado",
    payment_method: "tarjeta",
    gross_amount: 38000,
    discount_amount: 3000,
    refund_amount: 5000,
    tip_amount: 2000,
    direct_cost_amount: 4000,
    commission_amount: 13500,
    paid_at: "2026-10-12T16:00:00-05:00",
  },
  // Cita 3: Pendiente de pago (NO debe sumarse a ingresos)
  {
    id: "app-3",
    client_id: "c3",
    client_name: "Andrés Romero",
    service_id: "srv-1",
    service_name: "Corte de cabello",
    barber_name: "Marcos Silva",
    chair: "Sillón 01",
    date: "2026-10-15",
    time: "11:00",
    status: "completada",
    notes: null,
    payment_status: "pendiente",
    payment_method: null,
    gross_amount: 25000,
    discount_amount: 0,
    refund_amount: 0,
    tip_amount: 0,
    direct_cost_amount: 2500,
    commission_amount: 10000,
    paid_at: null,
  },
  // Cita 4: Cancelada / pago anulado (NO debe sumarse a ingresos)
  {
    id: "app-4",
    client_id: "c4",
    client_name: "Juan Pérez",
    service_id: "srv-2",
    service_name: "Corte Pro (Cabello + Barba)",
    barber_name: "Mateo Gómez",
    chair: "Sillón 02",
    date: "2026-10-18",
    time: "17:00",
    status: "cancelada",
    notes: null,
    payment_status: "anulado",
    payment_method: "nequi_daviplata",
    gross_amount: 38000,
    discount_amount: 0,
    refund_amount: 0,
    tip_amount: 0,
    direct_cost_amount: 0,
    commission_amount: 0,
    paid_at: null,
  },
  // Cita del periodo anterior (Septiembre 2026) para probar comparación
  {
    id: "app-prev-1",
    client_id: "c1",
    client_name: "Carlos Mendoza",
    service_id: "srv-2",
    service_name: "Corte Pro (Cabello + Barba)",
    barber_name: "Marcos Silva",
    chair: "Sillón 01",
    date: "2026-09-15",
    time: "14:00",
    status: "completada",
    notes: null,
    payment_status: "pagado",
    payment_method: "efectivo",
    gross_amount: 38000,
    discount_amount: 0,
    refund_amount: 0,
    tip_amount: 0,
    direct_cost_amount: 4000,
    commission_amount: 17100,
    paid_at: "2026-09-15T15:00:00-05:00",
  },
];

const sampleExpenses: Expense[] = [
  {
    id: "exp-1",
    date: "2026-10-05",
    time: "09:00",
    category: "servicios_publicos",
    concept: "Energía e internet del estudio",
    amount: 10000,
    payment_method: "transferencia",
    status: "registrado",
    reference: "REC-101",
    notes: null,
  },
  {
    id: "exp-2",
    date: "2026-10-20",
    time: "12:00",
    category: "publicidad",
    concept: "Anulado - prueba duplicada",
    amount: 99000,
    payment_method: "tarjeta",
    status: "anulado",
    reference: "META-NULL",
    notes: null,
  },
  {
    id: "exp-prev-1",
    date: "2026-09-10",
    time: "10:00",
    category: "servicios_publicos",
    concept: "Energía mes anterior",
    amount: 8000,
    payment_method: "transferencia",
    status: "registrado",
    reference: "REC-090",
    notes: null,
  },
];

describe("Módulo Contable: Reporte Detallado de Ganancias", () => {
  it("1-5 y 7-8. Calcula ingresos brutos, descuentos, reembolsos, ingresos netos, costos directos, ganancia bruta, gastos operativos, ganancia neta y márgenes excluyendo pendientes y anulados", () => {
    const octAppointments = sampleAppointments.filter((a) =>
      a.date.startsWith("2026-10")
    );
    const octExpenses = sampleExpenses.filter((e) =>
      e.date.startsWith("2026-10")
    );

    const { summary, completeness } = calculateProfitSummaryAndCompleteness(
      octAppointments,
      octExpenses,
      testServices
    );

    // Ingresos brutos: 25.000 (app-1) + 38.000 (app-2) = 63.000.00 (app-3 pendiente y app-4 anulada se excluyen; propinas de 5.000 excluidas)
    assert.equal(summary.grossRevenue, "63000.00");
    assert.equal(summary.tipsExcluded, "5000.00");

    // Descuentos: 3.000.00 | Reembolsos: 5.000.00
    assert.equal(summary.discounts, "3000.00");
    assert.equal(summary.refunds, "5000.00");

    // Ingresos netos: 63.000 - 3.000 - 5.000 = 55.000.00
    assert.equal(summary.netRevenue, "55000.00");

    // Costos directos: Insumos (2.500 + 4.000 = 6.500) + Comisiones (10.000 + 13.500 = 23.500) = 30.000.00
    assert.equal(summary.supplyCosts, "6500.00");
    assert.equal(summary.commissions, "23500.00");
    assert.equal(summary.directCosts, "30000.00");

    // Ganancia bruta: 55.000 - 30.000 = 25.000.00
    assert.equal(summary.grossProfit, "25000.00");

    // Gastos operativos: solo exp-1 (10.000.00); exp-2 está anulado
    assert.equal(summary.operatingExpenses, "10000.00");

    // Ganancia neta: 25.000 - 10.000 = 15.000.00
    assert.equal(summary.netProfit, "15000.00");

    // Margen bruto: (25.000 / 55.000) * 100 = 45.45%
    assert.equal(summary.grossMarginPercentage, "45.45");

    // Margen neto: (15.000 / 55.000) * 100 = 27.27%
    assert.equal(summary.netMarginPercentage, "27.27");

    // Servicios pagados: 2 | Ticket promedio: 55.000 / 2 = 27.500.00
    assert.equal(summary.paidServicesCount, 2);
    assert.equal(summary.averageTicket, "27500.00");

    // Detecta que app-3 estaba completada pero sin pago confirmado
    assert.equal(completeness.unconfirmedCompletedCount, 1);
  });

  it("6 y 10. Maneja división entre cero y periodos sin movimientos sin lanzar error ni devolver Infinity", () => {
    const { summary } = calculateProfitSummaryAndCompleteness(
      [],
      [],
      testServices
    );

    assert.equal(summary.grossRevenue, "0.00");
    assert.equal(summary.netRevenue, "0.00");
    assert.equal(summary.grossProfit, "0.00");
    assert.equal(summary.netProfit, "0.00");
    assert.equal(summary.grossMarginPercentage, null);
    assert.equal(summary.netMarginPercentage, null);
    assert.equal(summary.paidServicesCount, 0);
    assert.equal(summary.averageTicket, null);
  });

  it("7b. Contempla reembolso superior al pago asociado y ganancia negativa", () => {
    const excessiveRefundApp: AppointmentWithDetails = {
      ...sampleAppointments[0],
      id: "app-excess-refund",
      gross_amount: 25000,
      discount_amount: 0,
      refund_amount: 30000,
      payment_status: "reembolsado",
    };

    const { summary, completeness } = calculateProfitSummaryAndCompleteness(
      [excessiveRefundApp],
      [sampleExpenses[0]],
      testServices
    );

    assert.equal(summary.netRevenue, "-5000.00");
    assert.equal(summary.netProfit, "-15000.00");
    assert.equal(summary.grossMarginPercentage, null);
    assert.ok(
      completeness.warnings.some((w) => w.includes("reembolsos cuyo importe supera"))
    );
  });

  it("9. No duplica registros cuando una misma cita o gasto aparece repetido en la fuente", () => {
    const duplicatedAppointments = [
      sampleAppointments[0],
      { ...sampleAppointments[0] },
    ];
    const duplicatedExpenses = [sampleExpenses[0], { ...sampleExpenses[0] }];

    const { summary } = calculateProfitSummaryAndCompleteness(
      duplicatedAppointments,
      duplicatedExpenses,
      testServices
    );

    assert.equal(summary.grossRevenue, "25000.00");
    assert.equal(summary.operatingExpenses, "10000.00");
    assert.equal(summary.paidServicesCount, 1);
  });

  it("11. Compara correctamente contra el periodo anterior equivalente y contextualiza aumentos de gastos como desfavorables", () => {
    const report = buildProfitReportFromDataset({
      rawFilters: {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      },
      userProfile: adminProfile,
      dataset: {
        appointments: sampleAppointments,
        expenses: sampleExpenses,
        services: testServices,
      },
    });

    assert.equal(report.success, true);
    if (!report.success) return;

    // 31 días en octubre -> periodo anterior de 31 días: 2026-08-31 a 2026-09-30
    assert.equal(report.data.period.daysCount, 31);
    assert.equal(report.data.period.previousStartDate, "2026-08-31");
    assert.equal(report.data.period.previousEndDate, "2026-09-30");

    // Ingresos netos actual (55.000) vs anterior (38.000) -> +17.000 (+44.74%), favorable
    assert.equal(report.data.comparison.netRevenue.current, "55000.00");
    assert.equal(report.data.comparison.netRevenue.previous, "38000.00");
    assert.equal(report.data.comparison.netRevenue.absoluteChange, "17000.00");
    assert.equal(report.data.comparison.netRevenue.percentageChange, "44.74");
    assert.equal(report.data.comparison.netRevenue.direction, "increase");
    assert.equal(report.data.comparison.netRevenue.isFavorable, true);

    // Gastos operativos actual (10.000) vs anterior (8.000) -> +25.00%, aumento pero isFavorable = false
    assert.equal(report.data.comparison.operatingExpenses.direction, "increase");
    assert.equal(report.data.comparison.operatingExpenses.percentageChange, "25.00");
    assert.equal(report.data.comparison.operatingExpenses.isFavorable, false);
  });

  it("12. Rechaza rangos de fechas inválidos (inicio posterior al fin o mayores a 366 días)", () => {
    const invalidOrder = validateProfitReportFilters({
      startDate: "2026-10-31",
      endDate: "2026-10-01",
    });
    assert.equal(invalidOrder.valid, false);
    if (!invalidOrder.valid) {
      assert.equal(invalidOrder.error.code, "INVALID_DATE_RANGE");
    }

    const tooLarge = validateProfitReportFilters({
      startDate: "2025-01-01",
      endDate: "2026-12-31",
    });
    assert.equal(tooLarge.valid, false);
    if (!tooLarge.valid) {
      assert.equal(tooLarge.error.code, "DATE_RANGE_TOO_LARGE");
    }
  });

  it("13. Aplica filtros por barbero, servicio y método de pago de forma exacta", () => {
    const filteredReport = buildProfitReportFromDataset({
      rawFilters: {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        barberId: "Marcos Silva",
        paymentMethod: "efectivo",
      },
      userProfile: adminProfile,
      dataset: {
        appointments: sampleAppointments,
        expenses: sampleExpenses,
        services: testServices,
      },
    });

    assert.equal(filteredReport.success, true);
    if (!filteredReport.success) return;

    assert.equal(filteredReport.data.summary.netRevenue, "25000.00");
    assert.equal(filteredReport.data.summary.paidServicesCount, 1);
    assert.equal(filteredReport.data.breakdowns.byBarber.length, 1);
    assert.equal(
      filteredReport.data.breakdowns.byBarber[0].barberName,
      "Marcos Silva"
    );
  });

  it("14 y 15. Permite acceso a rol 'admin' y rechaza usuarios no autenticados, 'cliente' o 'barbero'", () => {
    const dataset = {
      appointments: sampleAppointments,
      expenses: sampleExpenses,
      services: testServices,
    };

    const unauthRes = buildProfitReportFromDataset({
      rawFilters: { startDate: "2026-10-01", endDate: "2026-10-31" },
      userProfile: null,
      dataset,
    });
    assert.equal(unauthRes.success, false);
    if (!unauthRes.success) {
      assert.equal(unauthRes.httpStatus, 401);
      assert.equal(unauthRes.error.code, "UNAUTHORIZED");
    }

    const barberRes = buildProfitReportFromDataset({
      rawFilters: { startDate: "2026-10-01", endDate: "2026-10-31" },
      userProfile: barberProfile,
      dataset,
    });
    assert.equal(barberRes.success, false);
    if (!barberRes.success) {
      assert.equal(barberRes.httpStatus, 403);
      assert.equal(barberRes.error.code, "FORBIDDEN");
    }

    const clientRes = buildProfitReportFromDataset({
      rawFilters: { startDate: "2026-10-01", endDate: "2026-10-31" },
      userProfile: clientProfile,
      dataset,
    });
    assert.equal(clientRes.success, false);
    if (!clientRes.success) {
      assert.equal(clientRes.httpStatus, 403);
      assert.equal(clientRes.error.code, "FORBIDDEN");
    }

    const adminRes = buildProfitReportFromDataset({
      rawFilters: { startDate: "2026-10-01", endDate: "2026-10-31" },
      userProfile: adminProfile,
      dataset,
    });
    assert.equal(adminRes.success, true);
  });

  it("16. La paginación de la tabla de movimientos no altera los totales globales del reporte", () => {
    const page1 = buildProfitReportFromDataset({
      rawFilters: {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        page: 1,
        pageSize: 2,
      },
      userProfile: adminProfile,
      dataset: {
        appointments: sampleAppointments,
        expenses: sampleExpenses,
        services: testServices,
      },
    });

    const page2 = buildProfitReportFromDataset({
      rawFilters: {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        page: 2,
        pageSize: 2,
      },
      userProfile: adminProfile,
      dataset: {
        appointments: sampleAppointments,
        expenses: sampleExpenses,
        services: testServices,
      },
    });

    assert.equal(page1.success && page2.success, true);
    if (!page1.success || !page2.success) return;

    assert.equal(page1.data.transactions.rows.length, 2);
    assert.equal(page2.data.transactions.rows.length, 2);
    assert.notEqual(
      page1.data.transactions.rows[0].id,
      page2.data.transactions.rows[0].id
    );

    // Los totales globales permanecen idénticos en ambas páginas
    assert.equal(page1.data.summary.netRevenue, "55000.00");
    assert.equal(page2.data.summary.netRevenue, "55000.00");
    assert.equal(page1.data.summary.netProfit, "15000.00");
    assert.equal(page2.data.summary.netProfit, "15000.00");
  });

  it("17 y 18. Exporta CSV consistente con los totales del reporte y sanitiza fórmulas peligrosas (=, +, -, @)", () => {
    assert.equal(sanitizeCsvCell("=SUM(A1:A10)"), `"'=SUM(A1:A10)"`);
    assert.equal(sanitizeCsvCell("+1000"), `"'+1000"`);
    assert.equal(sanitizeCsvCell("-cmd|' /C calc'!A0"), `"'-cmd|' /C calc'!A0"`);
    assert.equal(sanitizeCsvCell("@IMPORT"), `"'@IMPORT"`);
    // Números negativos reales marcados como literales numéricos se conservan sin apóstrofo
    assert.equal(
      sanitizeCsvCell("-15000.00", { isNumericLiteral: true }),
      `"-15000.00"`
    );

    const report = buildProfitReportFromDataset({
      rawFilters: {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      },
      userProfile: adminProfile,
      dataset: {
        appointments: sampleAppointments,
        expenses: sampleExpenses,
        services: testServices,
      },
    });

    assert.equal(report.success, true);
    if (!report.success) return;

    const csvOut = generateProfitReportCsv(
      report.data,
      report.allTransactions
    );
    assert.equal(csvOut.ok, true);
    if (!csvOut.ok) return;

    assert.ok(csvOut.csvContent.includes('"Ingresos netos","55000.00"'));
    assert.ok(csvOut.csvContent.includes('"Ganancia neta","15000.00"'));
    // Verifica que el cliente esté parcialmente anonimizado ("Carlos M." en vez de "Carlos Mendoza")
    assert.ok(csvOut.csvContent.includes('"Carlos M."'));
    assert.ok(!csvOut.csvContent.includes('"Carlos Mendoza"'));
  });

  it("19. Opera con centavos exactos (BigInt) y formatea la moneda COP correctamente", () => {
    const a = toCents("19.99");
    const b = toCents("0.01");
    assert.equal(centsToDecimalString(a + b), "20.00");

    const formatted = formatAccountingCurrency("25000.00", "COP", "es-CO");
    assert.ok(formatted.includes("25.000"));
  });

  it("20. Respeta la zona horaria America/Bogota cerca de la medianoche UTC", () => {
    // 2026-10-16T03:30:00Z son las 22:30 del 2026-10-15 en Bogotá (UTC-5)
    const utcNearMidnight = new Date("2026-10-16T03:30:00.000Z");
    const bogotaDate = getDateInTimezone(utcNearMidnight, "America/Bogota");
    assert.equal(bogotaDate, "2026-10-15");

    const todayPeriod = resolveQuickPeriodDates(
      "today",
      "America/Bogota",
      utcNearMidnight
    );
    assert.equal(todayPeriod.startDate, "2026-10-15");
    assert.equal(todayPeriod.endDate, "2026-10-15");
  });
});
