/* =====================================================================
   CONTABILIDAD DESDE LA API (lib/api/accounting.ts)
   ---------------------------------------------------------------------
   La API ya calcula el reporte con el modelo de reserva (spec F5); aquí
   solo se ADAPTA su respuesta al formato que usan los componentes de
   components/accounting/ (ProfitReportData). No se recalcula nada.
   Contrato: docs/contratos/api-rest.md §7 y §8 (tarea 4.9).
   ===================================================================== */

import "server-only";
import { siteConfig } from "@/lib/config";
import type { ExpenseCategory, PaymentMethod } from "@/lib/types";
import type {
  AccountingTransactionRow,
  MetricComparison,
  ProfitComparisonMap,
  ProfitReportData,
  ProfitReportErrorCode,
  ProfitSummary,
  QuickPeriodKey,
} from "@/lib/accounting/profit-report.types";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/accounting/profit-report.validation";
import { apiRequest } from "./client";
import { lower } from "./mappers";

/** Periodos que entiende la API (los mismos 4 botones de la pantalla + personalizado). */
const API_PERIODS: QuickPeriodKey[] = ["today", "this_week", "this_month", "last_month", "custom"];

type ApiSummary = {
  income: number;
  productSales: number;
  yourProfit: number;
  businessReserve: number;
  expenses: number;
  reserveBalance: number;
  servicesCount: number;
  averageTicket: number | null;
  tips: number;
};

type ApiRow = {
  id: string;
  type: "INGRESO" | "VENTA" | "GASTO";
  date: string;
  time: string;
  concept: string;
  clientName: string | null;
  paymentMethod: string | null;
  income: number;
  expense: number;
  tip: number;
  status: string;
  discount: number;
  refund: number;
  category: string | null;
  reference: string | null;
  voidReason: string | null;
  voidedAt: string | null;
};

type ApiReport = {
  period: { key: string; startDate: string; endDate: string };
  summary: ApiSummary;
  transactions: { rows: ApiRow[]; total: number; page: number; totalPages: number };
};

export type ApiCashClosing = {
  date: string;
  methods: { paymentMethod: string; income: number; tips: number; expenses: number; balance: number }[];
  totals: { income: number; tips: number; expenses: number };
  expectedCash: number;
};

export type ApiReportResult =
  | { success: true; data: ProfitReportData }
  | { success: false; error: { code: ProfitReportErrorCode; message: string } };

/** Categorías que la API acepta: incluye "Compra de insumos / productos" (3.29). */
export const API_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "arriendo",
  "servicios_publicos",
  "nomina_administrativa",
  "insumos_generales",
  "compra_insumos_productos",
  "publicidad",
  "mantenimiento",
  "otros",
];

/** Arma la consulta ?period=… de la API a partir de los parámetros de la página. */
export function buildReportQuery(params: {
  quickPeriod?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  pageSize?: string;
}): string {
  const q = new URLSearchParams();
  const wantsCustom = params.quickPeriod === "custom" || (!params.quickPeriod && params.startDate && params.endDate);
  const key = wantsCustom ? "custom" : (params.quickPeriod as QuickPeriodKey) ?? "this_month";
  q.set("period", API_PERIODS.includes(key) ? key : "this_month");
  if (q.get("period") === "custom") {
    if (params.startDate) q.set("startDate", params.startDate);
    if (params.endDate) q.set("endDate", params.endDate);
  }
  if (params.page) q.set("page", params.page);
  if (params.pageSize) q.set("size", params.pageSize);
  return q.toString();
}

export async function getApiProfitReport(query: string): Promise<ApiReportResult> {
  const res = await apiRequest<ApiReport>(`/accounting/report?${query}`);
  if (!res.ok) {
    const code: ProfitReportErrorCode =
      res.status === 401 ? "UNAUTHORIZED" : res.status === 403 ? "FORBIDDEN" : res.status === 400 ? "INVALID_FILTER" : "INTERNAL_ERROR";
    return { success: false, error: { code, message: res.message } };
  }
  return { success: true, data: toReportData(res.data, new URLSearchParams(query)) };
}

export async function getApiCashClosing(date?: string): Promise<ApiCashClosing | { error: string }> {
  const res = await apiRequest<ApiCashClosing>(
    `/accounting/cash-closing${date ? `?date=${encodeURIComponent(date)}` : ""}`
  );
  return res.ok ? res.data : { error: res.message };
}

/* ---------------------------------------------------------------------
   Adaptación al formato de los componentes
   --------------------------------------------------------------------- */

const money = (n: number) => String(n);

function emptyMetric(): MetricComparison {
  return { current: null, previous: null, absoluteChange: null, percentageChange: null, direction: "unchanged", isFavorable: null };
}

function toSummary(s: ApiSummary): ProfitSummary {
  // ProfitSummaryCards lee: netRevenue = Ingresos, grossProfit = Tu ganancia,
  // directCosts = Reserva del negocio, operatingExpenses = Gastos, tipsExcluded = Propinas.
  return {
    grossRevenue: money(s.income),
    discounts: "0",
    refunds: "0",
    netRevenue: money(s.income),
    directCosts: money(s.businessReserve),
    supplyCosts: money(s.businessReserve),
    commissions: "0",
    tipsExcluded: money(s.tips),
    grossProfit: money(s.yourProfit),
    operatingExpenses: money(s.expenses),
    netProfit: money(s.reserveBalance),
    partialNetProfit: money(s.reserveBalance),
    grossMarginPercentage: null,
    netMarginPercentage: null,
    paidServicesCount: s.servicesCount,
    averageTicket: s.averageTicket === null ? null : money(s.averageTicket),
  };
}

function toRow(r: ApiRow): AccountingTransactionRow {
  const method = r.paymentMethod ? lower<PaymentMethod>(r.paymentMethod) : null;
  const status = lower<string>(r.status);
  const base = {
    id: `${r.type}-${r.id}`,
    dateTime: `${r.date} ${r.time}`,
    date: r.date,
    time: r.time,
    reference: r.reference ?? "",
    relatedId: r.id,
    concept: r.concept,
    barberName: null,
    paymentMethod: method,
    paymentMethodLabel: method ? PAYMENT_METHOD_LABELS[method] : "—",
    tipAmount: money(r.tip),
    status,
    voidReason: r.voidReason,
    voidedAt: r.voidedAt,
  };

  if (r.type === "GASTO") {
    const category = r.category ? lower<ExpenseCategory>(r.category) : "otros";
    return {
      ...base,
      type: "gasto_operativo",
      typeLabel: `Gasto · ${EXPENSE_CATEGORY_LABELS[category] ?? category}`,
      clientAnonymized: null,
      grossIncome: "0",
      discountAmount: "0",
      refundAmount: "0",
      netIncome: "0",
      directCostAmount: "0",
      operatingExpenseAmount: money(r.expense),
      statusLabel: status === "anulado" ? "Anulado" : "Registrado",
      isCountedInTotals: status === "registrado",
      source: "expense",
      expenseCategory: category,
      expenseAmount: money(r.expense),
      expenseReference: r.reference,
    };
  }

  if (r.type === "VENTA") {
    return {
      ...base,
      type: "venta_producto",
      typeLabel: "Venta de producto",
      clientAnonymized: null,
      grossIncome: money(r.income),
      discountAmount: "0",
      refundAmount: "0",
      netIncome: money(r.income),
      directCostAmount: "0",
      operatingExpenseAmount: "0",
      statusLabel: status === "anulado" ? "Anulada" : "Registrada",
      isCountedInTotals: status === "registrado",
      source: "product_sale",
    };
  }

  return {
    ...base,
    type: status === "reembolsado" ? "reembolso_servicio" : "ingreso_servicio",
    typeLabel: status === "reembolsado" ? "Servicio con reembolso" : "Ingreso por servicio",
    clientAnonymized: r.clientName,
    grossIncome: money(r.income + r.discount + r.refund),
    discountAmount: money(r.discount),
    refundAmount: money(r.refund),
    netIncome: money(r.income),
    directCostAmount: "0",
    operatingExpenseAmount: "0",
    statusLabel: PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS] ?? status,
    isCountedInTotals: true,
    source: "appointment",
    appointmentStatus: "completada", // la API solo lista citas cobradas
  };
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

function toReportData(r: ApiReport, query: URLSearchParams): ProfitReportData {
  const summary = toSummary(r.summary);
  const comparisonKeys: (keyof ProfitComparisonMap)[] = [
    "grossRevenue", "discounts", "refunds", "netRevenue", "directCosts", "grossProfit", "operatingExpenses",
    "netProfit", "grossMarginPercentage", "netMarginPercentage", "paidServicesCount", "averageTicket",
  ];
  const comparison = Object.fromEntries(comparisonKeys.map((k) => [k, emptyMetric()])) as unknown as ProfitComparisonMap;
  const pageSize = Number(query.get("size")) || 15;

  return {
    generatedAt: new Date().toISOString(),
    period: {
      startDate: r.period.startDate,
      endDate: r.period.endDate,
      previousStartDate: r.period.startDate,
      previousEndDate: r.period.endDate,
      daysCount: daysBetween(r.period.startDate, r.period.endDate),
      timezone: siteConfig.timezone,
      currency: "COP",
      granularity: "day",
    },
    appliedFilters: {
      startDate: r.period.startDate,
      endDate: r.period.endDate,
      quickPeriod: r.period.key as QuickPeriodKey,
      page: r.transactions.page,
      pageSize,
      sortBy: "dateTime",
      sortOrder: "desc",
    },
    summary,
    previousSummary: summary,
    comparison,
    breakdowns: { byService: [], byBarber: [], byPaymentMethod: [], byExpenseCategory: [], timeSeries: [] },
    completeness: {
      isComplete: true,
      hasConfirmedPayments: r.summary.servicesCount > 0,
      hasDirectCostsConfigured: true,
      hasCommissionsConfigured: true,
      hasOperatingExpensesRecords: r.summary.expenses > 0,
      unconfirmedCompletedCount: 0,
      missingComponents: [],
      warnings: [],
      accountingNotes: [],
    },
    transactions: {
      rows: r.transactions.rows.map(toRow),
      total: r.transactions.total,
      page: r.transactions.page,
      pageSize,
      totalPages: r.transactions.totalPages,
      sortBy: "dateTime",
      sortOrder: "desc",
    },
    filterOptions: {
      barbers: [],
      services: [],
      paymentMethods: (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((id) => ({
        id,
        label: PAYMENT_METHOD_LABELS[id],
      })),
      paymentStatuses: [],
      expenseCategories: API_EXPENSE_CATEGORIES.map((id) => ({ id, label: EXPENSE_CATEGORY_LABELS[id] })),
    },
  };
}
