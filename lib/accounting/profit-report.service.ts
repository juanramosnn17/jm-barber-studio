/* =====================================================================
   SERVICIO ORQUESTADOR DEL REPORTE DE CONTABILIDAD Y GANANCIAS
   (lib/accounting/profit-report.service.ts)
   ===================================================================== */

import { siteConfig } from "../config";
import type {
  AppointmentWithDetails,
  Expense,
  Profile,
  Service,
} from "../types";
import type {
  AccountingTransactionRow,
  ProfitReportData,
  ProfitReportFilterOptions,
  ProfitReportResponse,
} from "./profit-report.types";
import {
  ALLOWED_EXPENSE_CATEGORIES,
  ALLOWED_PAYMENT_METHODS,
  ALLOWED_PAYMENT_STATUSES,
  buildPeriodInfo,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  validateAccountingPermission,
  validateProfitReportFilters,
} from "./profit-report.validation";
import {
  applyReportFiltersToDataset,
  buildAccountingTransactionRows,
  buildReportBreakdowns,
  buildSummaryComparisons,
  calculateProfitSummaryAndCompleteness,
  paginateTransactionRows,
} from "./profit-report.calculations";
import { generateProfitReportCsv } from "./profit-report.export";

export interface DatasetInput {
  appointments: AppointmentWithDetails[];
  expenses: Expense[];
  services: Service[];
  barberNames?: string[];
  operatingExpensesSourceAvailable?: boolean;
}

/**
 * Ejecuta el cálculo completo del reporte sobre un conjunto de datos ya cargado,
 * validando permisos y filtros en el servidor.
 */
export function buildProfitReportFromDataset(params: {
  rawFilters: Record<string, unknown>;
  userProfile: Profile | null;
  dataset: DatasetInput;
  timezone?: string;
  currency?: string;
  referenceNow?: Date;
}):
  | {
      success: true;
      httpStatus: 200;
      data: ProfitReportData;
      allTransactions: AccountingTransactionRow[];
    }
  | {
      success: false;
      httpStatus: 400 | 401 | 403 | 500;
      error: {
        code:
          | "UNAUTHORIZED"
          | "FORBIDDEN"
          | "INVALID_DATE_RANGE"
          | "DATE_RANGE_TOO_LARGE"
          | "INVALID_FILTER"
          | "EXPORT_LIMIT_EXCEEDED"
          | "INTERNAL_ERROR";
        message: string;
      };
    } {
  const {
    rawFilters,
    userProfile,
    dataset,
    timezone = siteConfig.timezone,
    currency = siteConfig.currency,
    referenceNow = new Date(),
  } = params;

  // 1. Validar autorización por rol
  const authCheck = validateAccountingPermission(userProfile);
  if (!authCheck.authorized) {
    return {
      success: false,
      httpStatus: authCheck.httpStatus,
      error: authCheck.error,
    };
  }

  // 2. Construir conjuntos de entidades conocidas para validar identificadores
  const serviceIds = new Set(dataset.services.map((s) => s.id));
  const barberSet = new Set<string>(dataset.barberNames ?? []);
  for (const app of dataset.appointments) {
    if (app.barber_name && app.barber_name.trim()) {
      barberSet.add(app.barber_name.trim());
    }
  }

  // 3. Validar filtros
  const validation = validateProfitReportFilters(
    rawFilters,
    {
      serviceIds: serviceIds.size > 0 ? serviceIds : undefined,
      barberNames: barberSet.size > 0 ? barberSet : undefined,
    },
    timezone,
    referenceNow
  );

  if (!validation.valid) {
    return {
      success: false,
      httpStatus: 400,
      error: validation.error,
    };
  }

  const filters = validation.filters;
  const period = buildPeriodInfo(
    filters.startDate,
    filters.endDate,
    timezone,
    currency
  );

  // 4. Filtrar datos del periodo actual y del periodo anterior equivalente
  const currentFiltered = applyReportFiltersToDataset(
    dataset.appointments,
    dataset.expenses,
    filters,
    { startDate: period.startDate, endDate: period.endDate }
  );

  const previousFiltered = applyReportFiltersToDataset(
    dataset.appointments,
    dataset.expenses,
    filters,
    {
      startDate: period.previousStartDate,
      endDate: period.previousEndDate,
    }
  );

  const completenessContext = {
    operatingExpensesSourceAvailable:
      dataset.operatingExpensesSourceAvailable ?? true,
  };

  // 5. Calcular indicadores del periodo actual y del periodo anterior
  const currentResult = calculateProfitSummaryAndCompleteness(
    currentFiltered.filteredAppointments,
    currentFiltered.filteredExpenses,
    dataset.services,
    completenessContext
  );

  const previousResult = calculateProfitSummaryAndCompleteness(
    previousFiltered.filteredAppointments,
    previousFiltered.filteredExpenses,
    dataset.services,
    completenessContext
  );

  // 6. Construir comparaciones frente al periodo anterior equivalente
  const comparison = buildSummaryComparisons(
    currentResult.summary,
    previousResult.summary
  );

  // 7. Construir desgloses y evolución temporal
  const breakdowns = buildReportBreakdowns({
    resolvedAppointments: currentResult.resolvedAppointments,
    currentExpenses: currentFiltered.filteredExpenses,
    previousExpenses: previousFiltered.filteredExpenses,
    services: dataset.services,
    startDate: period.startDate,
    endDate: period.endDate,
    granularity: period.granularity,
  });

  // 8. Construir tabla auditable y paginación en el servidor
  const sortBy = filters.sortBy ?? "dateTime";
  const sortOrder = filters.sortOrder ?? "desc";
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 15;

  const allTransactions = buildAccountingTransactionRows(
    currentResult.resolvedAppointments,
    currentFiltered.filteredExpenses,
    sortBy,
    sortOrder
  );

  const transactions = paginateTransactionRows(
    allTransactions,
    page,
    pageSize,
    sortBy,
    sortOrder
  );

  const filterOptions: ProfitReportFilterOptions = {
    barbers: Array.from(barberSet)
      .filter((b) => b !== "Pendiente de asignación" && b !== "Sin asignar")
      .sort()
      .map((name) => ({ id: name, name })),
    services: dataset.services.map((s) => ({ id: s.id, name: s.name })),
    paymentMethods: ALLOWED_PAYMENT_METHODS.map((id) => ({
      id,
      label: PAYMENT_METHOD_LABELS[id],
    })),
    paymentStatuses: ALLOWED_PAYMENT_STATUSES.map((id) => ({
      id,
      label: PAYMENT_STATUS_LABELS[id],
    })),
    expenseCategories: ALLOWED_EXPENSE_CATEGORIES.map((id) => ({
      id,
      label: EXPENSE_CATEGORY_LABELS[id],
    })),
  };

  const reportData: ProfitReportData = {
    generatedAt: referenceNow.toISOString(),
    period,
    appliedFilters: filters,
    summary: currentResult.summary,
    previousSummary: previousResult.summary,
    comparison,
    breakdowns,
    completeness: currentResult.completeness,
    transactions,
    filterOptions,
  };

  return {
    success: true,
    httpStatus: 200,
    data: reportData,
    allTransactions,
  };
}

/**
 * Obtiene el reporte de ganancias consultando el repositorio de servidor
 * (Supabase + almacén en memoria).
 */
export async function getServerProfitReport(
  rawFilters: Record<string, unknown>,
  profileOverride?: Profile | null
): Promise<ProfitReportResponse & { httpStatus: number }> {
  try {
    const { fetchAccountingDataset, getAuthenticatedProfile } = await import(
      "./profit-report.repository"
    );

    const userProfile =
      profileOverride !== undefined
        ? profileOverride
        : await getAuthenticatedProfile();

    const authCheck = validateAccountingPermission(userProfile);
    if (!authCheck.authorized) {
      return {
        success: false,
        httpStatus: authCheck.httpStatus,
        error: authCheck.error,
      };
    }

    // Validación preliminar de fechas antes de consultar la base de datos
    const preliminaryValidation = validateProfitReportFilters(rawFilters);
    if (!preliminaryValidation.valid) {
      return {
        success: false,
        httpStatus: 400,
        error: preliminaryValidation.error,
      };
    }

    const prelimPeriod = buildPeriodInfo(
      preliminaryValidation.filters.startDate,
      preliminaryValidation.filters.endDate
    );

    const dataset = await fetchAccountingDataset(
      prelimPeriod.previousStartDate,
      prelimPeriod.endDate
    );

    const result = buildProfitReportFromDataset({
      rawFilters,
      userProfile,
      dataset,
    });

    if (!result.success) {
      return {
        success: false,
        httpStatus: result.httpStatus,
        error: result.error,
      };
    }

    return {
      success: true,
      httpStatus: 200,
      data: result.data,
    };
  } catch {
    return {
      success: false,
      httpStatus: 500,
      error: {
        code: "INTERNAL_ERROR",
        message:
          "No fue posible generar el reporte contable en este momento. Intenta nuevamente.",
      },
    };
  }
}

/**
 * Genera la exportación CSV desde el servidor validando permisos y filtros.
 */
export async function exportServerProfitReportCsv(
  rawFilters: Record<string, unknown>,
  profileOverride?: Profile | null
): Promise<
  | {
      success: true;
      httpStatus: 200;
      csvContent: string;
      filename: string;
    }
  | {
      success: false;
      httpStatus: number;
      error: { code: string; message: string };
    }
> {
  try {
    const { fetchAccountingDataset, getAuthenticatedProfile } = await import(
      "./profit-report.repository"
    );

    const userProfile =
      profileOverride !== undefined
        ? profileOverride
        : await getAuthenticatedProfile();

    const authCheck = validateAccountingPermission(userProfile);
    if (!authCheck.authorized) {
      return {
        success: false,
        httpStatus: authCheck.httpStatus,
        error: authCheck.error,
      };
    }

    const preliminaryValidation = validateProfitReportFilters(rawFilters);
    if (!preliminaryValidation.valid) {
      return {
        success: false,
        httpStatus: 400,
        error: preliminaryValidation.error,
      };
    }

    const prelimPeriod = buildPeriodInfo(
      preliminaryValidation.filters.startDate,
      preliminaryValidation.filters.endDate
    );

    const dataset = await fetchAccountingDataset(
      prelimPeriod.previousStartDate,
      prelimPeriod.endDate
    );

    const reportResult = buildProfitReportFromDataset({
      rawFilters,
      userProfile,
      dataset,
    });

    if (!reportResult.success) {
      return {
        success: false,
        httpStatus: reportResult.httpStatus,
        error: reportResult.error,
      };
    }

    const csvResult = generateProfitReportCsv(
      reportResult.data,
      reportResult.allTransactions
    );

    if (!csvResult.ok) {
      return {
        success: false,
        httpStatus: 400,
        error: {
          code: csvResult.code,
          message: csvResult.message,
        },
      };
    }

    return {
      success: true,
      httpStatus: 200,
      csvContent: csvResult.csvContent,
      filename: csvResult.filename,
    };
  } catch {
    return {
      success: false,
      httpStatus: 500,
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al generar la exportación CSV del reporte.",
      },
    };
  }
}
