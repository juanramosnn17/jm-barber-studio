/* =====================================================================
   MOTOR DE CÁLCULO CONTABLE Y FINANCIERO EN CENTAVOS EXACTOS (BigInt)
   (lib/accounting/profit-report.calculations.ts)
   ===================================================================== */

import { siteConfig } from "../config";
import type {
  AppointmentWithDetails,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  Service,
} from "../types";
import type {
  AccountingTransactionRow,
  BarberBreakdownItem,
  ChangeDirection,
  DataCompletenessStatus,
  ExpenseCategoryBreakdownItem,
  MetricComparison,
  PaymentMethodBreakdownItem,
  ProfitComparisonMap,
  ProfitReportFilters,
  ProfitSummary,
  ServiceBreakdownItem,
  SortDirection,
  TimeGranularity,
  TimeSeriesPoint,
  TransactionSortField,
} from "./profit-report.types";
import {
  addDaysISO,
  ALLOWED_EXPENSE_CATEGORIES,
  ALLOWED_PAYMENT_METHODS,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "./profit-report.validation";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10000);

/**
 * Convierte un importe numérico o en cadena a centavos enteros exactos (BigInt).
 * Evita errores de punto flotante (IEEE 754) en sumas, restas y porcentajes.
 */
export function toCents(value: number | string | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return ZERO;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return ZERO;
    return BigInt(Math.round(value * 100));
  }
  const clean = value.trim().replace(/,/g, ".");
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return ZERO;
  const isNegative = clean.startsWith("-");
  const unsigned = isNegative ? clean.slice(1) : clean;
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  const paddedFrac = (fracPart + "00").slice(0, 2);
  const thirdDigit = fracPart.length >= 3 ? Number(fracPart[2]) : 0;
  let cents = BigInt(intPart) * HUNDRED + BigInt(paddedFrac);
  if (thirdDigit >= 5) cents += ONE;
  return isNegative ? -cents : cents;
}

/**
 * Convierte centavos enteros (BigInt) a representación decimal exacta ("18500000.00").
 */
export function centsToDecimalString(cents: bigint): string {
  const isNegative = cents < ZERO;
  const abs = isNegative ? -cents : cents;
  const whole = abs / HUNDRED;
  const frac = abs % HUNDRED;
  const formatted = `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Calcula un porcentaje con redondeo al centésimo más cercano ("75.84").
 * Si el denominador es <= 0, devuelve null para evitar división entre cero o porcentajes distorsionados sobre bases negativas.
 */
export function calculateSafePercentage(
  numeratorCents: bigint,
  denominatorCents: bigint
): string | null {
  if (denominatorCents <= ZERO) return null;
  const isNegative = numeratorCents < ZERO;
  const absNum = isNegative ? -numeratorCents : numeratorCents;
  // Multiplicamos por 10000 (100% * 100 centésimas) y sumamos mitad del denominador para redondeo half-up
  const basisPoints =
    (absNum * TEN_THOUSAND + denominatorCents / TWO) / denominatorCents;
  const whole = basisPoints / HUNDRED;
  const frac = basisPoints % HUNDRED;
  const result = `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
  return isNegative && basisPoints > ZERO ? `-${result}` : result;
}

/**
 * Formatea una cadena decimal ("18500000.00") o número en la moneda del sistema (COP por defecto).
 */
export function formatAccountingCurrency(
  amount: string | number | null | undefined,
  currency: string = siteConfig.currency,
  locale: string = siteConfig.locale
): string {
  if (amount === null || amount === undefined || amount === "") return "N/D";
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric)) return "N/D";
  const hasCents = Math.round(Math.abs(numeric) * 100) % 100 !== 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "COP" && !hasCents ? 0 : 2,
    maximumFractionDigits: currency === "COP" && !hasCents ? 0 : 2,
  }).format(numeric);
}

/**
 * Elimina registros duplicados por `id` para garantizar que ninguna cita o gasto
 * se contabilice dos veces cuando se combinan fuentes.
 */
export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

/**
 * Determina si una cita tiene un pago válido para contabilizarse en el reporte de ingresos.
 * Regla obligatoria: No se cuentan citas pendientes, confirmadas sin completar, canceladas,
 * ni citas con payment_status 'pendiente' o 'anulado'.
 */
export function isAppointmentFinanciallyValid(
  appointment: AppointmentWithDetails
): boolean {
  if (appointment.status !== "completada") return false;
  if (
    appointment.payment_status !== "pagado" &&
    appointment.payment_status !== "reembolsado"
  ) {
    return false;
  }
  return true;
}

export interface ResolvedAppointmentFinancials {
  appointment: AppointmentWithDetails;
  isCounted: boolean;
  isPaidServiceUnit: boolean;
  grossCents: bigint;
  discountCents: bigint;
  refundCents: bigint;
  netCents: bigint;
  supplyCostCents: bigint;
  commissionCents: bigint;
  directCostCents: bigint;
  tipCents: bigint;
  grossProfitCents: bigint;
  hasMissingCostData: boolean;
  hasRefundExceedingGross: boolean;
}

/**
 * Resuelve los importes en centavos de una cita individual cruzando con su servicio.
 */
export function resolveAppointmentFinancials(
  appointment: AppointmentWithDetails,
  servicesById: Map<string, Service>
): ResolvedAppointmentFinancials {
  const service = servicesById.get(appointment.service_id);
  const isCounted = isAppointmentFinanciallyValid(appointment);

  if (!isCounted) {
    return {
      appointment,
      isCounted: false,
      isPaidServiceUnit: false,
      grossCents: ZERO,
      discountCents: ZERO,
      refundCents: ZERO,
      netCents: ZERO,
      supplyCostCents: ZERO,
      commissionCents: ZERO,
      directCostCents: ZERO,
      tipCents: ZERO,
      grossProfitCents: ZERO,
      hasMissingCostData: false,
      hasRefundExceedingGross: false,
    };
  }

  const rawGross = appointment.gross_amount ?? service?.price ?? 0;
  const grossCents = toCents(rawGross);
  const discountCents = toCents(appointment.discount_amount ?? 0);
  const refundCents = toCents(appointment.refund_amount ?? 0);
  const tipCents = toCents(appointment.tip_amount ?? 0);

  const netCents = grossCents - discountCents - refundCents;
  const hasRefundExceedingGross = refundCents > grossCents - discountCents;

  // MODELO DE LA BARBERÍA (spec F5, tarea 3.27): el dueño es el único barbero,
  // así que NO hay comisión ni costo de insumos oculto por servicio. Cada
  // servicio cobrado aparta una RESERVA fija para los gastos del negocio:
  // la fijada en la cita al completarla o, si no existe, la actual del servicio.
  const hasSupplyCost = true;
  const hasCommission = true;

  // Si el servicio fue reembolsado en su totalidad (netCents <= 0), no aparta reserva ni cuenta como unidad vendida
  const isPaidServiceUnit = netCents > ZERO;

  const reserveCents = isPaidServiceUnit
    ? toCents(appointment.reserve_amount ?? service?.reserve_amount ?? 0)
    : ZERO;
  // La reserva nunca supera lo efectivamente cobrado
  const supplyCostCents = reserveCents > netCents ? netCents : reserveCents;
  const commissionCents = ZERO;

  const directCostCents = supplyCostCents + commissionCents;
  const grossProfitCents = netCents - directCostCents;

  return {
    appointment,
    isCounted: true,
    isPaidServiceUnit,
    grossCents,
    discountCents,
    refundCents,
    netCents,
    supplyCostCents,
    commissionCents,
    directCostCents,
    tipCents,
    grossProfitCents,
    hasMissingCostData: !hasSupplyCost || !hasCommission,
    hasRefundExceedingGross,
  };
}

/**
 * Filtra las citas y los gastos operativos de acuerdo con los filtros activos del reporte.
 */
export function applyReportFiltersToDataset(
  appointments: AppointmentWithDetails[],
  expenses: Expense[],
  filters: ProfitReportFilters,
  dateRangeOverride?: { startDate: string; endDate: string }
): {
  filteredAppointments: AppointmentWithDetails[];
  filteredExpenses: Expense[];
} {
  const startDate = dateRangeOverride?.startDate ?? filters.startDate;
  const endDate = dateRangeOverride?.endDate ?? filters.endDate;

  const uniqueAppointments = deduplicateById(appointments);
  const uniqueExpenses = deduplicateById(expenses);

  const filteredAppointments = uniqueAppointments.filter((app) => {
    if (app.date < startDate || app.date > endDate) return false;
    if (filters.serviceId && app.service_id !== filters.serviceId) return false;
    if (filters.barberId && (app.barber_name ?? "") !== filters.barberId) {
      return false;
    }
    if (
      filters.paymentMethod &&
      app.payment_method !== filters.paymentMethod
    ) {
      return false;
    }
    if (
      filters.paymentStatus &&
      (app.payment_status ?? "pendiente") !== filters.paymentStatus
    ) {
      return false;
    }
    // Si el usuario filtra específicamente por una categoría de gasto operativo, las citas no pertenecen a esa categoría
    if (filters.expenseCategoryId) {
      return false;
    }
    return true;
  });

  const filteredExpenses = uniqueExpenses.filter((exp) => {
    if (exp.date < startDate || exp.date > endDate) return false;
    if (filters.expenseCategoryId && exp.category !== filters.expenseCategoryId) {
      return false;
    }
    if (filters.paymentMethod && exp.payment_method !== filters.paymentMethod) {
      return false;
    }
    // Si se filtra por barbero o servicio específico, los gastos operativos generales no se asignan a un barbero/servicio individual
    if (filters.barberId || filters.serviceId) {
      return false;
    }
    return true;
  });

  return { filteredAppointments, filteredExpenses };
}

export interface CompletenessContext {
  /** Indica si la fuente de gastos operativos está disponible en el sistema */
  operatingExpensesSourceAvailable?: boolean;
}

/**
 * Calcula el resumen financiero completo (ProfitSummary) y el estado de completitud
 * de los datos (DataCompletenessStatus).
 */
export function calculateProfitSummaryAndCompleteness(
  appointments: AppointmentWithDetails[],
  expenses: Expense[],
  services: Service[],
  context: CompletenessContext = { operatingExpensesSourceAvailable: true }
): {
  summary: ProfitSummary;
  completeness: DataCompletenessStatus;
  resolvedAppointments: ResolvedAppointmentFinancials[];
} {
  const servicesById = new Map<string, Service>(
    services.map((s) => [s.id, s])
  );

  const uniqueAppointments = deduplicateById(appointments);
  const uniqueExpenses = deduplicateById(expenses);

  let grossRevenueCents = ZERO;
  let discountsCents = ZERO;
  let refundsCents = ZERO;
  let netRevenueCents = ZERO;
  let supplyCostsCents = ZERO;
  let commissionsCents = ZERO;
  let directCostsCents = ZERO;
  let tipsExcludedCents = ZERO;
  let paidServicesCount = 0;

  let unconfirmedCompletedCount = 0;
  let anyMissingCostData = false;
  let anyRefundExceedingGross = false;

  const resolvedAppointments: ResolvedAppointmentFinancials[] = [];

  for (const app of uniqueAppointments) {
    if (
      app.status === "completada" &&
      app.payment_status !== "pagado" &&
      app.payment_status !== "reembolsado"
    ) {
      unconfirmedCompletedCount += 1;
    }

    const resolved = resolveAppointmentFinancials(app, servicesById);
    resolvedAppointments.push(resolved);

    if (!resolved.isCounted) continue;

    grossRevenueCents += resolved.grossCents;
    discountsCents += resolved.discountCents;
    refundsCents += resolved.refundCents;
    netRevenueCents += resolved.netCents;
    supplyCostsCents += resolved.supplyCostCents;
    commissionsCents += resolved.commissionCents;
    directCostsCents += resolved.directCostCents;
    tipsExcludedCents += resolved.tipCents;

    if (resolved.isPaidServiceUnit) {
      paidServicesCount += 1;
    }
    if (resolved.hasMissingCostData) {
      anyMissingCostData = true;
    }
    if (resolved.hasRefundExceedingGross) {
      anyRefundExceedingGross = true;
    }
  }

  let operatingExpensesCents = ZERO;
  for (const exp of uniqueExpenses) {
    if (exp.status === "registrado") {
      operatingExpensesCents += toCents(exp.amount);
    }
  }

  const grossProfitCents = netRevenueCents - directCostsCents;
  const partialNetProfitCents = grossProfitCents - operatingExpensesCents;

  const grossMarginPercentage = calculateSafePercentage(
    grossProfitCents,
    netRevenueCents
  );

  const averageTicketCents =
    paidServicesCount > 0
      ? (netRevenueCents + BigInt(Math.floor(paidServicesCount / 2))) /
        BigInt(paidServicesCount)
      : null;

  // Evaluación de completitud de datos
  const missingComponents: string[] = [];
  const warnings: string[] = [];

  // Modelo de reserva (tarea 3.27): no hay comisiones ni costos de insumos por
  // servicio que configurar; la reserva vale 0 si el servicio no la tiene.
  const hasDirectCostsConfigured = !anyMissingCostData;
  const hasCommissionsConfigured = true;

  const operatingExpensesAvailable =
    context.operatingExpensesSourceAvailable ?? true;

  if (!hasDirectCostsConfigured) {
    missingComponents.push("Costos de insumos por servicio");
  }
  if (!hasCommissionsConfigured) {
    missingComponents.push("Comisiones de barberos");
  }
  if (!operatingExpensesAvailable) {
    missingComponents.push("Registro de gastos operativos");
  }

  if (unconfirmedCompletedCount > 0) {
    warnings.push(
      `Se excluyeron ${unconfirmedCompletedCount} cita(s) marcada(s) como completada(s) porque no tienen confirmación de pago.`
    );
  }

  if (anyRefundExceedingGross) {
    warnings.push(
      "Se detectaron reembolsos cuyo importe supera el valor neto del pago original."
    );
  }

  const isComplete = missingComponents.length === 0;
  const netProfitString = isComplete
    ? centsToDecimalString(partialNetProfitCents)
    : null;
  const netMarginPercentage = isComplete
    ? calculateSafePercentage(partialNetProfitCents, netRevenueCents)
    : null;

  const accountingNotes = [
    "Los ingresos brutos incluyen únicamente citas completadas con pago confirmado ('pagado' o 'reembolsado').",
    "Las propinas se registran como valores transferidos al barbero y no se suman a los ingresos brutos del estudio.",
    "Las comisiones de barberos e insumos consumidos se contabilizan dentro de los costos directos.",
  ];

  return {
    summary: {
      grossRevenue: centsToDecimalString(grossRevenueCents),
      discounts: centsToDecimalString(discountsCents),
      refunds: centsToDecimalString(refundsCents),
      netRevenue: centsToDecimalString(netRevenueCents),
      directCosts: centsToDecimalString(directCostsCents),
      supplyCosts: centsToDecimalString(supplyCostsCents),
      commissions: centsToDecimalString(commissionsCents),
      tipsExcluded: centsToDecimalString(tipsExcludedCents),
      grossProfit: centsToDecimalString(grossProfitCents),
      operatingExpenses: centsToDecimalString(operatingExpensesCents),
      netProfit: netProfitString,
      partialNetProfit: centsToDecimalString(partialNetProfitCents),
      grossMarginPercentage,
      netMarginPercentage,
      paidServicesCount,
      averageTicket:
        averageTicketCents !== null
          ? centsToDecimalString(averageTicketCents)
          : null,
    },
    completeness: {
      isComplete,
      hasConfirmedPayments: paidServicesCount > 0,
      hasDirectCostsConfigured,
      hasCommissionsConfigured,
      hasOperatingExpensesRecords:
        operatingExpensesAvailable &&
        uniqueExpenses.some((e) => e.status === "registrado"),
      unconfirmedCompletedCount,
      missingComponents,
      warnings,
      accountingNotes,
    },
    resolvedAppointments,
  };
}

/**
 * Compara dos valores monetarios o porcentuales (actual vs anterior).
 * Contextualiza si un aumento es favorable o desfavorable (`inverseFavorable = true` para gastos/costos).
 */
export function compareMetricValues(
  currentValue: string | number | null,
  previousValue: string | number | null,
  options: { isInteger?: boolean; inverseFavorable?: boolean } = {}
): MetricComparison {
  if (currentValue === null || previousValue === null) {
    return {
      current: currentValue !== null ? String(currentValue) : null,
      previous: previousValue !== null ? String(previousValue) : null,
      absoluteChange: null,
      percentageChange: null,
      direction: "unchanged",
      isFavorable: null,
    };
  }

  const currentCents = options.isInteger
    ? BigInt(Math.round(Number(currentValue))) * HUNDRED
    : toCents(currentValue);
  const previousCents = options.isInteger
    ? BigInt(Math.round(Number(previousValue))) * HUNDRED
    : toCents(previousValue);

  const diffCents = currentCents - previousCents;
  let direction: ChangeDirection = "unchanged";
  if (diffCents > ZERO) direction = "increase";
  else if (diffCents < ZERO) direction = "decrease";

  let percentageChange: string | null = null;
  if (previousCents === ZERO) {
    percentageChange = currentCents === ZERO ? "0.00" : null;
  } else {
    const absPrev = previousCents < ZERO ? -previousCents : previousCents;
    const isNegDiff = diffCents < ZERO;
    const absDiff = isNegDiff ? -diffCents : diffCents;
    const bp = (absDiff * TEN_THOUSAND + absPrev / TWO) / absPrev;
    const whole = bp / HUNDRED;
    const frac = bp % HUNDRED;
    const formatted = `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
    percentageChange = isNegDiff && bp > ZERO ? `-${formatted}` : formatted;
  }

  let isFavorable: boolean | null = null;
  if (direction !== "unchanged") {
    if (options.inverseFavorable) {
      // En gastos, costos, descuentos o reembolsos: subir es desfavorable, bajar es favorable
      isFavorable = direction === "decrease";
    } else {
      isFavorable = direction === "increase";
    }
  }

  return {
    current: options.isInteger
      ? String(Math.round(Number(currentValue)))
      : centsToDecimalString(currentCents),
    previous: options.isInteger
      ? String(Math.round(Number(previousValue)))
      : centsToDecimalString(previousCents),
    absoluteChange: options.isInteger
      ? String(Math.round(Number(diffCents / HUNDRED)))
      : centsToDecimalString(diffCents),
    percentageChange,
    direction,
    isFavorable,
  };
}

/**
 * Construye el mapa completo de comparaciones entre el periodo actual y el periodo anterior equivalente.
 */
export function buildSummaryComparisons(
  current: ProfitSummary,
  previous: ProfitSummary
): ProfitComparisonMap {
  return {
    grossRevenue: compareMetricValues(
      current.grossRevenue,
      previous.grossRevenue
    ),
    discounts: compareMetricValues(current.discounts, previous.discounts, {
      inverseFavorable: true,
    }),
    refunds: compareMetricValues(current.refunds, previous.refunds, {
      inverseFavorable: true,
    }),
    netRevenue: compareMetricValues(current.netRevenue, previous.netRevenue),
    directCosts: compareMetricValues(
      current.directCosts,
      previous.directCosts,
      { inverseFavorable: true }
    ),
    grossProfit: compareMetricValues(current.grossProfit, previous.grossProfit),
    operatingExpenses: compareMetricValues(
      current.operatingExpenses,
      previous.operatingExpenses,
      { inverseFavorable: true }
    ),
    netProfit: compareMetricValues(
      current.netProfit ?? current.partialNetProfit,
      previous.netProfit ?? previous.partialNetProfit
    ),
    grossMarginPercentage: compareMetricValues(
      current.grossMarginPercentage,
      previous.grossMarginPercentage
    ),
    netMarginPercentage: compareMetricValues(
      current.netMarginPercentage,
      previous.netMarginPercentage
    ),
    paidServicesCount: compareMetricValues(
      current.paidServicesCount,
      previous.paidServicesCount,
      { isInteger: true }
    ),
    averageTicket: compareMetricValues(
      current.averageTicket,
      previous.averageTicket
    ),
  };
}

/**
 * Construye los desgloses por servicio, por barbero, por método de pago,
 * por categoría de gasto y la evolución temporal.
 */
export function buildReportBreakdowns(params: {
  resolvedAppointments: ResolvedAppointmentFinancials[];
  currentExpenses: Expense[];
  previousExpenses: Expense[];
  services: Service[];
  startDate: string;
  endDate: string;
  granularity: TimeGranularity;
}): {
  byService: ServiceBreakdownItem[];
  byBarber: BarberBreakdownItem[];
  byPaymentMethod: PaymentMethodBreakdownItem[];
  byExpenseCategory: ExpenseCategoryBreakdownItem[];
  timeSeries: TimeSeriesPoint[];
} {
  const {
    resolvedAppointments,
    currentExpenses,
    previousExpenses,
    services,
    startDate,
    endDate,
    granularity,
  } = params;

  const servicesById = new Map<string, Service>(
    services.map((s) => [s.id, s])
  );

  const totalNetRevenueCents = resolvedAppointments.reduce(
    (acc, r) => (r.isCounted ? acc + r.netCents : acc),
    ZERO
  );

  // 1. Desglose por Servicio
  const serviceMap = new Map<
    string,
    {
      serviceId: string;
      serviceName: string;
      paidQuantity: number;
      grossCents: bigint;
      discountCents: bigint;
      refundCents: bigint;
      netCents: bigint;
      supplyCents: bigint;
      commissionCents: bigint;
      directCents: bigint;
      grossProfitCents: bigint;
    }
  >();

  for (const r of resolvedAppointments) {
    if (!r.isCounted) continue;
    const srv = servicesById.get(r.appointment.service_id);
    const serviceId = r.appointment.service_id;
    const serviceName = srv?.name ?? r.appointment.service_name ?? "Servicio";

    const current = serviceMap.get(serviceId) ?? {
      serviceId,
      serviceName,
      paidQuantity: 0,
      grossCents: ZERO,
      discountCents: ZERO,
      refundCents: ZERO,
      netCents: ZERO,
      supplyCents: ZERO,
      commissionCents: ZERO,
      directCents: ZERO,
      grossProfitCents: ZERO,
    };

    if (r.isPaidServiceUnit) current.paidQuantity += 1;
    current.grossCents += r.grossCents;
    current.discountCents += r.discountCents;
    current.refundCents += r.refundCents;
    current.netCents += r.netCents;
    current.supplyCents += r.supplyCostCents;
    current.commissionCents += r.commissionCents;
    current.directCents += r.directCostCents;
    current.grossProfitCents += r.grossProfitCents;

    serviceMap.set(serviceId, current);
  }

  const byService: ServiceBreakdownItem[] = Array.from(serviceMap.values())
    .sort((a, b) => (b.netCents > a.netCents ? 1 : b.netCents < a.netCents ? -1 : 0))
    .map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      paidQuantity: item.paidQuantity,
      grossRevenue: centsToDecimalString(item.grossCents),
      discounts: centsToDecimalString(item.discountCents),
      refunds: centsToDecimalString(item.refundCents),
      netRevenue: centsToDecimalString(item.netCents),
      directCost: centsToDecimalString(item.directCents),
      supplyCost: centsToDecimalString(item.supplyCents),
      commissionCost: centsToDecimalString(item.commissionCents),
      grossProfit: centsToDecimalString(item.grossProfitCents),
      revenueSharePercentage: calculateSafePercentage(
        item.netCents,
        totalNetRevenueCents
      ),
    }));

  // 2. Resultados por Barbero (objetivo y financiero)
  const barberMap = new Map<
    string,
    {
      barberName: string;
      completedAndPaidCount: number;
      grossCents: bigint;
      discountCents: bigint;
      refundCents: bigint;
      netCents: bigint;
      tipsCents: bigint;
      commissionsCents: bigint;
      supplyCents: bigint;
      profitContributionCents: bigint;
    }
  >();

  for (const r of resolvedAppointments) {
    if (!r.isCounted) continue;
    const barberName =
      r.appointment.barber_name?.trim() || "Sin asignar";

    const current = barberMap.get(barberName) ?? {
      barberName,
      completedAndPaidCount: 0,
      grossCents: ZERO,
      discountCents: ZERO,
      refundCents: ZERO,
      netCents: ZERO,
      tipsCents: ZERO,
      commissionsCents: ZERO,
      supplyCents: ZERO,
      profitContributionCents: ZERO,
    };

    if (r.isPaidServiceUnit) current.completedAndPaidCount += 1;
    current.grossCents += r.grossCents;
    current.discountCents += r.discountCents;
    current.refundCents += r.refundCents;
    current.netCents += r.netCents;
    current.tipsCents += r.tipCents;
    current.commissionsCents += r.commissionCents;
    current.supplyCents += r.supplyCostCents;
    current.profitContributionCents += r.grossProfitCents;

    barberMap.set(barberName, current);
  }

  const byBarber: BarberBreakdownItem[] = Array.from(barberMap.values())
    .sort((a, b) => (b.netCents > a.netCents ? 1 : b.netCents < a.netCents ? -1 : 0))
    .map((item) => ({
      barberName: item.barberName,
      completedAndPaidCount: item.completedAndPaidCount,
      grossRevenueGenerated: centsToDecimalString(item.grossCents),
      discountsAssociated: centsToDecimalString(item.discountCents),
      refundsAssociated: centsToDecimalString(item.refundCents),
      netRevenueGenerated: centsToDecimalString(item.netCents),
      tipsReceived: centsToDecimalString(item.tipsCents),
      commissionsEarned: centsToDecimalString(item.commissionsCents),
      supplyCostsAssociated: centsToDecimalString(item.supplyCents),
      profitContribution: centsToDecimalString(item.profitContributionCents),
    }));

  // 3. Ingresos por Método de Pago
  const paymentMap = new Map<
    PaymentMethod,
    {
      paymentMethod: PaymentMethod;
      transactionsCount: number;
      grossCents: bigint;
      discountCents: bigint;
      refundCents: bigint;
      netCents: bigint;
    }
  >();

  for (const r of resolvedAppointments) {
    if (!r.isCounted) continue;
    const method: PaymentMethod = r.appointment.payment_method ?? "efectivo";
    const current = paymentMap.get(method) ?? {
      paymentMethod: method,
      transactionsCount: 0,
      grossCents: ZERO,
      discountCents: ZERO,
      refundCents: ZERO,
      netCents: ZERO,
    };

    current.transactionsCount += 1;
    current.grossCents += r.grossCents;
    current.discountCents += r.discountCents;
    current.refundCents += r.refundCents;
    current.netCents += r.netCents;

    paymentMap.set(method, current);
  }

  const byPaymentMethod: PaymentMethodBreakdownItem[] = ALLOWED_PAYMENT_METHODS.map(
    (method) => {
      const item = paymentMap.get(method);
      return {
        paymentMethod: method,
        label: PAYMENT_METHOD_LABELS[method],
        transactionsCount: item?.transactionsCount ?? 0,
        grossAmount: centsToDecimalString(item?.grossCents ?? ZERO),
        discounts: centsToDecimalString(item?.discountCents ?? ZERO),
        refunds: centsToDecimalString(item?.refundCents ?? ZERO),
        netAmount: centsToDecimalString(item?.netCents ?? ZERO),
        gatewayCommissions: null,
      };
    }
  ).filter((m) => m.transactionsCount > 0);

  // 4. Gastos por Categoría
  const activeCurrentExpenses = currentExpenses.filter(
    (e) => e.status === "registrado"
  );
  const activePrevExpenses = previousExpenses.filter(
    (e) => e.status === "registrado"
  );

  const totalCurrentExpensesCents = activeCurrentExpenses.reduce(
    (acc, e) => acc + toCents(e.amount),
    ZERO
  );

  const expenseCatCurrent = new Map<
    ExpenseCategory,
    { amountCents: bigint; count: number }
  >();
  for (const exp of activeCurrentExpenses) {
    const curr = expenseCatCurrent.get(exp.category) ?? {
      amountCents: ZERO,
      count: 0,
    };
    curr.amountCents += toCents(exp.amount);
    curr.count += 1;
    expenseCatCurrent.set(exp.category, curr);
  }

  const expenseCatPrev = new Map<ExpenseCategory, bigint>();
  for (const exp of activePrevExpenses) {
    const prev = expenseCatPrev.get(exp.category) ?? ZERO;
    expenseCatPrev.set(exp.category, prev + toCents(exp.amount));
  }

  const byExpenseCategory: ExpenseCategoryBreakdownItem[] =
    ALLOWED_EXPENSE_CATEGORIES.map((category) => {
      const curr = expenseCatCurrent.get(category) ?? {
        amountCents: ZERO,
        count: 0,
      };
      const prevCents = expenseCatPrev.get(category) ?? ZERO;
      const comp = compareMetricValues(
        centsToDecimalString(curr.amountCents),
        centsToDecimalString(prevCents),
        { inverseFavorable: true }
      );

      return {
        category,
        label: EXPENSE_CATEGORY_LABELS[category],
        totalAmount: centsToDecimalString(curr.amountCents),
        recordsCount: curr.count,
        expenseSharePercentage: calculateSafePercentage(
          curr.amountCents,
          totalCurrentExpensesCents
        ),
        previousTotalAmount: centsToDecimalString(prevCents),
        percentageChange: comp.percentageChange,
        direction: comp.direction,
      };
    }).filter(
      (item) => item.recordsCount > 0 || toCents(item.previousTotalAmount) > ZERO
    );

  // 5. Evolución Temporal
  const timeSeries = buildTimeSeriesPoints({
    resolvedAppointments,
    expenses: activeCurrentExpenses,
    startDate,
    endDate,
    granularity,
  });

  return {
    byService,
    byBarber,
    byPaymentMethod,
    byExpenseCategory,
    timeSeries,
  };
}

function getBucketKeyAndLabel(
  dateISO: string,
  timeHHMM: string,
  granularity: TimeGranularity
): { key: string; label: string } {
  if (granularity === "hour") {
    const hour = (timeHHMM || "09:00").slice(0, 2);
    return { key: `${dateISO}T${hour}:00`, label: `${hour}:00` };
  }
  if (granularity === "day") {
    const [, m, d] = dateISO.split("-");
    return { key: dateISO, label: `${d}/${m}` };
  }
  if (granularity === "week") {
    const [y, m, d] = dateISO.split("-").map(Number);
    const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
    const weekStart = addDaysISO(dateISO, diffToMonday);
    const [, wm, wd] = weekStart.split("-");
    return { key: weekStart, label: `Sem ${wd}/${wm}` };
  }
  // month
  const [y, m] = dateISO.split("-");
  const monthNames = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const mIdx = Math.max(0, Math.min(11, Number(m) - 1));
  return { key: `${y}-${m}`, label: `${monthNames[mIdx]} ${y}` };
}

function buildTimeSeriesPoints(params: {
  resolvedAppointments: ResolvedAppointmentFinancials[];
  expenses: Expense[];
  startDate: string;
  endDate: string;
  granularity: TimeGranularity;
}): TimeSeriesPoint[] {
  const { resolvedAppointments, expenses, startDate, endDate, granularity } =
    params;

  const buckets = new Map<
    string,
    {
      bucketKey: string;
      label: string;
      grossCents: bigint;
      netCents: bigint;
      directCents: bigint;
      expenseCents: bigint;
      paidServicesCount: number;
    }
  >();

  // Pre-poblar contenedores en rangos por hora o por día para continuidad visual
  if (granularity === "hour") {
    for (let h = 8; h <= 20; h++) {
      const hh = String(h).padStart(2, "0");
      const key = `${startDate}T${hh}:00`;
      buckets.set(key, {
        bucketKey: key,
        label: `${hh}:00`,
        grossCents: ZERO,
        netCents: ZERO,
        directCents: ZERO,
        expenseCents: ZERO,
        paidServicesCount: 0,
      });
    }
  } else {
    let cursor = startDate;
    while (cursor <= endDate) {
      const { key, label } = getBucketKeyAndLabel(cursor, "12:00", granularity);
      if (!buckets.has(key)) {
        buckets.set(key, {
          bucketKey: key,
          label,
          grossCents: ZERO,
          netCents: ZERO,
          directCents: ZERO,
          expenseCents: ZERO,
          paidServicesCount: 0,
        });
      }
      cursor = addDaysISO(cursor, 1);
    }
  }

  for (const r of resolvedAppointments) {
    if (!r.isCounted) continue;
    const { key, label } = getBucketKeyAndLabel(
      r.appointment.date,
      r.appointment.time,
      granularity
    );
    const bucket = buckets.get(key) ?? {
      bucketKey: key,
      label,
      grossCents: ZERO,
      netCents: ZERO,
      directCents: ZERO,
      expenseCents: ZERO,
      paidServicesCount: 0,
    };

    bucket.grossCents += r.grossCents;
    bucket.netCents += r.netCents;
    bucket.directCents += r.directCostCents;
    if (r.isPaidServiceUnit) bucket.paidServicesCount += 1;
    buckets.set(key, bucket);
  }

  for (const exp of expenses) {
    if (exp.status !== "registrado") continue;
    const { key, label } = getBucketKeyAndLabel(
      exp.date,
      exp.time || "12:00",
      granularity
    );
    const bucket = buckets.get(key) ?? {
      bucketKey: key,
      label,
      grossCents: ZERO,
      netCents: ZERO,
      directCents: ZERO,
      expenseCents: ZERO,
      paidServicesCount: 0,
    };
    bucket.expenseCents += toCents(exp.amount);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey))
    .map((b) => {
      const grossProfitCents = b.netCents - b.directCents;
      const netProfitCents = grossProfitCents - b.expenseCents;
      return {
        bucketKey: b.bucketKey,
        label: b.label,
        grossRevenue: centsToDecimalString(b.grossCents),
        netRevenue: centsToDecimalString(b.netCents),
        directCosts: centsToDecimalString(b.directCents),
        grossProfit: centsToDecimalString(grossProfitCents),
        operatingExpenses: centsToDecimalString(b.expenseCents),
        netProfit: centsToDecimalString(netProfitCents),
        paidServicesCount: b.paidServicesCount,
      };
    });
}

/**
 * Construye la lista unificada de movimientos contables para la tabla auditable
 * y aplica ordenamiento seguro en el servidor.
 */
export function buildAccountingTransactionRows(
  resolvedAppointments: ResolvedAppointmentFinancials[],
  expenses: Expense[],
  sortBy: TransactionSortField = "dateTime",
  sortOrder: SortDirection = "desc"
): AccountingTransactionRow[] {
  const rows: AccountingTransactionRow[] = [];

  for (const r of resolvedAppointments) {
    // Vista de la barbería (tarea 3.28): la tabla muestra solo citas cobradas;
    // las pendientes o canceladas no son movimientos de dinero.
    if (!r.isCounted) continue;
    const app = r.appointment;
    const payStatus = app.payment_status ?? "pendiente";
    const methodLabel = app.payment_method
      ? PAYMENT_METHOD_LABELS[app.payment_method]
      : "No registrado";

    let type: AccountingTransactionRow["type"] = "no_contabilizado";
    let typeLabel = "Cita sin cobro confirmado";
    if (r.isCounted) {
      if (r.refundCents > ZERO) {
        type = "reembolso_servicio";
        typeLabel = "Servicio con reembolso";
      } else {
        type = "ingreso_servicio";
        typeLabel = "Ingreso por servicio";
      }
    }

    rows.push({
      id: `mov-app-${app.id}`,
      dateTime: `${app.date} ${app.time.slice(0, 5)}`,
      date: app.date,
      time: app.time.slice(0, 5),
      type,
      typeLabel,
      reference: `CITA-${app.id.toUpperCase()}`,
      relatedId: app.id,
      concept: app.service_name || "Servicio de barbería",
      clientAnonymized: app.client_name || "Cliente", // nombre real: solo lo ve el admin (tarea 3.28)
      barberName: app.barber_name || "Sin asignar",
      paymentMethod: app.payment_method ?? null,
      paymentMethodLabel: methodLabel,
      grossIncome: centsToDecimalString(r.grossCents),
      discountAmount: centsToDecimalString(r.discountCents),
      refundAmount: centsToDecimalString(r.refundCents),
      netIncome: centsToDecimalString(r.netCents),
      directCostAmount: centsToDecimalString(r.directCostCents),
      operatingExpenseAmount: "0.00",
      tipAmount: centsToDecimalString(r.tipCents),
      status: payStatus,
      statusLabel: `${app.status.toUpperCase()} / ${PAYMENT_STATUS_LABELS[payStatus]}`,
      isCountedInTotals: r.isCounted,
      source: "appointment",
      appointmentStatus: app.status,
    });
  }

  for (const exp of expenses) {
    const isCounted = exp.status === "registrado";
    const expCents = isCounted ? toCents(exp.amount) : ZERO;
    const categoryLabel = EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category;

    rows.push({
      id: `mov-exp-${exp.id}`,
      dateTime: `${exp.date} ${(exp.time || "12:00").slice(0, 5)}`,
      date: exp.date,
      time: (exp.time || "12:00").slice(0, 5),
      type: isCounted ? "gasto_operativo" : "no_contabilizado",
      typeLabel: `Gasto: ${categoryLabel}`,
      reference: exp.reference || `GASTO-${exp.id.toUpperCase()}`,
      relatedId: exp.id,
      concept: exp.concept,
      clientAnonymized: null,
      barberName: null,
      paymentMethod: exp.payment_method,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[exp.payment_method],
      grossIncome: "0.00",
      discountAmount: "0.00",
      refundAmount: "0.00",
      netIncome: "0.00",
      directCostAmount: "0.00",
      operatingExpenseAmount: centsToDecimalString(expCents),
      tipAmount: "0.00",
      status: exp.status,
      statusLabel: exp.status === "registrado" ? "Registrado" : "Anulado",
      isCountedInTotals: isCounted,
      source: "expense",
      expenseCategory: exp.category,
      expenseAmount: centsToDecimalString(toCents(exp.amount)),
      expenseReference: exp.reference,
      voidReason: exp.void_reason ?? null,
      voidedAt: exp.voided_at ?? null,
    });
  }

  const multiplier = sortOrder === "asc" ? 1 : -1;

  rows.sort((a, b) => {
    switch (sortBy) {
      case "incomeAmount": {
        const diff = toCents(a.netIncome) - toCents(b.netIncome);
        return diff > ZERO ? multiplier : diff < ZERO ? -multiplier : 0;
      }
      case "expenseAmount": {
        const aOut = toCents(a.directCostAmount) + toCents(a.operatingExpenseAmount);
        const bOut = toCents(b.directCostAmount) + toCents(b.operatingExpenseAmount);
        const diff = aOut - bOut;
        return diff > ZERO ? multiplier : diff < ZERO ? -multiplier : 0;
      }
      case "type":
        return a.typeLabel.localeCompare(b.typeLabel) * multiplier;
      case "concept":
        return a.concept.localeCompare(b.concept) * multiplier;
      case "status":
        return a.statusLabel.localeCompare(b.statusLabel) * multiplier;
      case "dateTime":
      default:
        return a.dateTime.localeCompare(b.dateTime) * multiplier;
    }
  });

  return rows;
}

/**
 * Pagina las transacciones del lado del servidor sin alterar los cálculos globales.
 */
export function paginateTransactionRows(
  allRows: AccountingTransactionRow[],
  page: number,
  pageSize: number,
  sortBy: TransactionSortField,
  sortOrder: SortDirection
) {
  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const start = (safePage - 1) * pageSize;
  const rows = allRows.slice(start, start + pageSize);

  return {
    rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
    sortBy,
    sortOrder,
  };
}
