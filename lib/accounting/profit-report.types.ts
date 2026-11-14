/* =====================================================================
   TIPOS CONTABLES Y CONTRATO DE REPORTE DE GANANCIAS
   (lib/accounting/profit-report.types.ts)
   ===================================================================== */

import type {
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
} from "../types";

export type QuickPeriodKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export type TimeGranularity = "hour" | "day" | "week" | "month";

export type ChangeDirection = "increase" | "decrease" | "unchanged";

export type TransactionSortField =
  | "dateTime"
  | "type"
  | "concept"
  | "incomeAmount"
  | "expenseAmount"
  | "status";

export type SortDirection = "asc" | "desc";

export type ProfitReportErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_DATE_RANGE"
  | "DATE_RANGE_TOO_LARGE"
  | "INVALID_FILTER"
  | "EXPORT_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";

export interface ProfitReportFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  quickPeriod?: QuickPeriodKey | null;
  barberId?: string | null; // Nombre o identificador del barbero
  serviceId?: string | null;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus | null;
  expenseCategoryId?: ExpenseCategory | null;
  branchId?: string | null;
  page?: number;
  pageSize?: number;
  sortBy?: TransactionSortField;
  sortOrder?: SortDirection;
}

export interface ProfitPeriodInfo {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  daysCount: number;
  timezone: string;
  currency: string;
  granularity: TimeGranularity;
}

/**
 * Todos los importes monetarios en el contrato se expresan como cadenas
 * decimales exactas con 2 decimales ("18500000.00") para evitar pérdida de
 * precisión, calculadas internamente con enteros en centavos (BigInt/enteros seguros).
 */
export interface ProfitSummary {
  grossRevenue: string;
  discounts: string;
  refunds: string;
  netRevenue: string;
  directCosts: string;
  supplyCosts: string;
  commissions: string;
  tipsExcluded: string;
  grossProfit: string;
  operatingExpenses: string;
  netProfit: string | null; // null cuando faltan componentes esenciales y no puede afirmarse ganancia neta definitiva
  partialNetProfit: string; // cálculo con los componentes disponibles (etiquetado como parcial si isComplete === false)
  grossMarginPercentage: string | null;
  netMarginPercentage: string | null;
  paidServicesCount: number;
  averageTicket: string | null;
}

export interface MetricComparison {
  current: string | null;
  previous: string | null;
  absoluteChange: string | null;
  percentageChange: string | null;
  direction: ChangeDirection;
  /**
   * Indica si la dirección del cambio es favorable financieramente.
   * Por ejemplo, un aumento en gastos operativos tiene direction="increase",
   * pero isFavorable=false para no presentarlo como positivo.
   */
  isFavorable: boolean | null;
}

export interface ProfitComparisonMap {
  grossRevenue: MetricComparison;
  discounts: MetricComparison;
  refunds: MetricComparison;
  netRevenue: MetricComparison;
  directCosts: MetricComparison;
  grossProfit: MetricComparison;
  operatingExpenses: MetricComparison;
  netProfit: MetricComparison;
  grossMarginPercentage: MetricComparison;
  netMarginPercentage: MetricComparison;
  paidServicesCount: MetricComparison;
  averageTicket: MetricComparison;
}

export interface ServiceBreakdownItem {
  serviceId: string;
  serviceName: string;
  paidQuantity: number;
  grossRevenue: string;
  discounts: string;
  refunds: string;
  netRevenue: string;
  directCost: string | null;
  supplyCost: string;
  commissionCost: string;
  grossProfit: string;
  revenueSharePercentage: string | null;
}

export interface BarberBreakdownItem {
  barberName: string;
  completedAndPaidCount: number;
  grossRevenueGenerated: string;
  discountsAssociated: string;
  refundsAssociated: string;
  netRevenueGenerated: string;
  tipsReceived: string;
  commissionsEarned: string;
  supplyCostsAssociated: string;
  profitContribution: string | null;
}

export interface PaymentMethodBreakdownItem {
  paymentMethod: PaymentMethod;
  label: string;
  transactionsCount: number;
  grossAmount: string;
  discounts: string;
  refunds: string;
  netAmount: string;
  gatewayCommissions: string | null;
}

export interface ExpenseCategoryBreakdownItem {
  category: ExpenseCategory;
  label: string;
  totalAmount: string;
  recordsCount: number;
  expenseSharePercentage: string | null;
  previousTotalAmount: string;
  percentageChange: string | null;
  direction: ChangeDirection;
}

export interface TimeSeriesPoint {
  bucketKey: string;
  label: string;
  grossRevenue: string;
  netRevenue: string;
  directCosts: string;
  grossProfit: string;
  operatingExpenses: string;
  netProfit: string;
  paidServicesCount: number;
}

export interface DataCompletenessStatus {
  isComplete: boolean;
  hasConfirmedPayments: boolean;
  hasDirectCostsConfigured: boolean;
  hasCommissionsConfigured: boolean;
  hasOperatingExpensesRecords: boolean;
  unconfirmedCompletedCount: number;
  missingComponents: string[];
  warnings: string[];
  accountingNotes: string[];
}

export type AccountingMovementType =
  | "ingreso_servicio"
  | "reembolso_servicio"
  | "gasto_operativo"
  | "no_contabilizado";

export interface AccountingTransactionRow {
  id: string;
  dateTime: string; // YYYY-MM-DD HH:MM
  date: string;
  time: string;
  type: AccountingMovementType;
  typeLabel: string;
  reference: string;
  relatedId: string;
  concept: string;
  clientAnonymized: string | null;
  barberName: string | null;
  paymentMethod: PaymentMethod | null;
  paymentMethodLabel: string;
  grossIncome: string;
  discountAmount: string;
  refundAmount: string;
  netIncome: string;
  directCostAmount: string;
  operatingExpenseAmount: string;
  tipAmount: string;
  status: string;
  statusLabel: string;
  isCountedInTotals: boolean;
  /** Datos para los ajustes contables del comprobante (spec F5, tareas 3.23–3.26). */
  source: "appointment" | "expense";
  appointmentStatus?: string;
  expenseCategory?: string;
  expenseAmount?: string;
  expenseReference?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
}

export interface PaginatedTransactions {
  rows: AccountingTransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy: TransactionSortField;
  sortOrder: SortDirection;
}

export interface ProfitReportFilterOptions {
  barbers: { id: string; name: string }[];
  services: { id: string; name: string }[];
  paymentMethods: { id: PaymentMethod; label: string }[];
  paymentStatuses: { id: PaymentStatus; label: string }[];
  expenseCategories: { id: ExpenseCategory; label: string }[];
}

export interface ProfitReportData {
  generatedAt: string;
  period: ProfitPeriodInfo;
  appliedFilters: ProfitReportFilters;
  summary: ProfitSummary;
  previousSummary: ProfitSummary;
  comparison: ProfitComparisonMap;
  breakdowns: {
    byService: ServiceBreakdownItem[];
    byBarber: BarberBreakdownItem[];
    byPaymentMethod: PaymentMethodBreakdownItem[];
    byExpenseCategory: ExpenseCategoryBreakdownItem[];
    timeSeries: TimeSeriesPoint[];
  };
  completeness: DataCompletenessStatus;
  transactions: PaginatedTransactions;
  filterOptions: ProfitReportFilterOptions;
}

export type ProfitReportResponse =
  | {
      success: true;
      data: ProfitReportData;
    }
  | {
      success: false;
      error: {
        code: ProfitReportErrorCode;
        message: string;
      };
    };
