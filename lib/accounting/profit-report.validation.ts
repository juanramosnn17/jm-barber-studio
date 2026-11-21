/* =====================================================================
   VALIDACIÓN DE FILTROS, FECHAS, ZONA HORARIA Y PERMISOS CONTABLES
   (lib/accounting/profit-report.validation.ts)
   ===================================================================== */

import { siteConfig } from "../config";
import type {
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  Profile,
} from "../types";
import type {
  ProfitPeriodInfo,
  ProfitReportErrorCode,
  ProfitReportFilters,
  QuickPeriodKey,
  SortDirection,
  TimeGranularity,
  TransactionSortField,
} from "./profit-report.types";

export const MAX_REPORT_DAYS = 366;
export const MAX_EXPORT_ROWS = 5000;
export const DEFAULT_PAGE_SIZE = 15;
export const MAX_PAGE_SIZE = 100;

export const ALLOWED_PAYMENT_METHODS: readonly PaymentMethod[] = [
  "efectivo",
  "transferencia",
  "tarjeta",
  "nequi_daviplata",
] as const;

export const ALLOWED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pendiente",
  "pagado",
  "reembolsado",
  "anulado",
] as const;

export const ALLOWED_EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "arriendo",
  "servicios_publicos",
  "nomina_administrativa",
  "insumos_generales",
  "publicidad",
  "mantenimiento",
  "otros",
] as const;

export const ALLOWED_QUICK_PERIODS: readonly QuickPeriodKey[] = [
  "today",
  "yesterday",
  "this_week",
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "custom",
] as const;

export const ALLOWED_SORT_FIELDS: readonly TransactionSortField[] = [
  "dateTime",
  "type",
  "concept",
  "incomeAmount",
  "expenseAmount",
  "status",
] as const;

export const ALLOWED_SORT_DIRECTIONS: readonly SortDirection[] = [
  "asc",
  "desc",
] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia bancaria",
  tarjeta: "Tarjeta débito / crédito",
  nequi_daviplata: "Nequi / Daviplata",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  reembolsado: "Reembolsado",
  anulado: "Anulado",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  arriendo: "Arriendo del local",
  servicios_publicos: "Servicios públicos e internet",
  nomina_administrativa: "Nómina administrativa",
  insumos_generales: "Insumos generales y aseo",
  compra_insumos_productos: "Compra de insumos / productos",
  publicidad: "Publicidad y marketing",
  mantenimiento: "Mantenimiento y equipos",
  otros: "Otros gastos operativos",
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Obtiene la fecha "YYYY-MM-DD" en la zona horaria del negocio (ej. America/Bogota).
 * Evita desfases cuando el servidor corre en UTC cerca de la medianoche.
 */
export function getDateInTimezone(
  date: Date = new Date(),
  timezone: string = siteConfig.timezone
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/**
 * Verifica que una cadena tenga formato YYYY-MM-DD y sea una fecha calendario real.
 */
export function isValidISODateString(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Suma o resta días a una fecha "YYYY-MM-DD" usando aritmética UTC pura sin deriva horaria.
 */
export function addDaysISO(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calcula la cantidad de días inclusivos entre startDate y endDate.
 * Ejemplo: 2026-09-01 a 2026-09-30 -> 30 días.
 */
export function diffDaysInclusive(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Resuelve un acceso rápido de periodo (hoy, ayer, esta semana, mes actual,
 * mes anterior, trimestre actual, año actual) respetando la zona horaria configurada.
 */
export function resolveQuickPeriodDates(
  quickPeriod: QuickPeriodKey,
  timezone: string = siteConfig.timezone,
  referenceNow: Date = new Date()
): { startDate: string; endDate: string } {
  const todayISO = getDateInTimezone(referenceNow, timezone);
  const [y, m, d] = todayISO.split("-").map(Number);

  switch (quickPeriod) {
    case "today":
      return { startDate: todayISO, endDate: todayISO };

    case "yesterday": {
      const yesterday = addDaysISO(todayISO, -1);
      return { startDate: yesterday, endDate: yesterday };
    }

    case "this_week": {
      // Lunes como inicio de semana (ISO-8601 en Colombia)
      const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
      const startOfWeek = addDaysISO(todayISO, diffToMonday);
      const endOfWeek = addDaysISO(startOfWeek, 6);
      return { startDate: startOfWeek, endDate: endOfWeek };
    }

    case "this_month": {
      const startOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const endOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { startDate: startOfMonth, endDate: endOfMonth };
    }

    case "last_month": {
      const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
      const py = prevMonthDate.getUTCFullYear();
      const pm = prevMonthDate.getUTCMonth() + 1;
      const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return {
        startDate: `${py}-${String(pm).padStart(2, "0")}-01`,
        endDate: `${py}-${String(pm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }

    case "this_quarter": {
      const quarterStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      const quarterEndMonth = quarterStartMonth + 2;
      const lastDay = new Date(Date.UTC(y, quarterEndMonth, 0)).getUTCDate();
      return {
        startDate: `${y}-${String(quarterStartMonth).padStart(2, "0")}-01`,
        endDate: `${y}-${String(quarterEndMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }

    case "this_year": {
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
      };
    }

    case "custom":
    default: {
      const startOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const endOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { startDate: startOfMonth, endDate: endOfMonth };
    }
  }
}

/**
 * Calcula el periodo anterior equivalente inmediatamente previo con la misma
 * duración exacta en días.
 * Ejemplo: 2026-09-01 al 2026-09-30 (30 días) -> 2026-08-02 al 2026-08-31.
 */
export function calculatePreviousPeriod(
  startDate: string,
  endDate: string
): { previousStartDate: string; previousEndDate: string; daysCount: number } {
  const daysCount = diffDaysInclusive(startDate, endDate);
  const previousEndDate = addDaysISO(startDate, -1);
  const previousStartDate = addDaysISO(startDate, -daysCount);
  return { previousStartDate, previousEndDate, daysCount };
}

/**
 * Determina la granularidad temporal óptima para la serie de tiempo según
 * el número de días del rango consultado.
 */
export function determineTimeGranularity(daysCount: number): TimeGranularity {
  if (daysCount <= 1) return "hour";
  if (daysCount <= 31) return "day";
  if (daysCount <= 120) return "week";
  return "month";
}

/**
 * Construye los metadatos completos del periodo consultado y su periodo comparativo.
 */
export function buildPeriodInfo(
  startDate: string,
  endDate: string,
  timezone: string = siteConfig.timezone,
  currency: string = siteConfig.currency
): ProfitPeriodInfo {
  const { previousStartDate, previousEndDate, daysCount } =
    calculatePreviousPeriod(startDate, endDate);
  const granularity = determineTimeGranularity(daysCount);
  return {
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    daysCount,
    timezone,
    currency,
    granularity,
  };
}

/**
 * Valida la autorización del usuario para acceder al reporte de ganancias.
 * Únicamente el rol 'admin' tiene permiso global al módulo contable.
 */
export function validateAccountingPermission(
  profile: Profile | null
):
  | { authorized: true; profile: Profile }
  | {
      authorized: false;
      httpStatus: 401 | 403;
      error: { code: ProfitReportErrorCode; message: string };
    } {
  if (!profile) {
    return {
      authorized: false,
      httpStatus: 401,
      error: {
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesión para consultar reportes financieros.",
      },
    };
  }

  if (profile.role !== "admin") {
    return {
      authorized: false,
      httpStatus: 403,
      error: {
        code: "FORBIDDEN",
        message:
          "Acceso denegado. Solo los administradores están autorizados para consultar el reporte contable de ganancias.",
      },
    };
  }

  return { authorized: true, profile };
}

/**
 * Valida y normaliza los filtros del reporte en el servidor.
 * Comprueba rangos de fechas, límites interactivos, listas blancas de ordenamiento
 * y existencia de identificadores contra los catálogos reales cuando se suministran.
 */
export function validateProfitReportFilters(
  rawInput: Record<string, unknown>,
  knownEntities?: {
    serviceIds?: Set<string>;
    barberNames?: Set<string>;
  },
  timezone: string = siteConfig.timezone,
  referenceNow: Date = new Date()
):
  | { valid: true; filters: ProfitReportFilters }
  | {
      valid: false;
      error: { code: ProfitReportErrorCode; message: string };
    } {
  const rawQuick =
    typeof rawInput.quickPeriod === "string" && rawInput.quickPeriod.trim() !== ""
      ? rawInput.quickPeriod.trim()
      : null;

  let quickPeriod: QuickPeriodKey | null = null;
  if (rawQuick) {
    if (!ALLOWED_QUICK_PERIODS.includes(rawQuick as QuickPeriodKey)) {
      return {
        valid: false,
        error: {
          code: "INVALID_FILTER",
          message: "El periodo rápido seleccionado no es válido.",
        },
      };
    }
    quickPeriod = rawQuick as QuickPeriodKey;
  }

  const rawStart =
    typeof rawInput.startDate === "string" ? rawInput.startDate.trim() : "";
  const rawEnd =
    typeof rawInput.endDate === "string" ? rawInput.endDate.trim() : "";

  let startDate = rawStart;
  let endDate = rawEnd;

  if (quickPeriod && quickPeriod !== "custom" && (!startDate || !endDate)) {
    const resolved = resolveQuickPeriodDates(quickPeriod, timezone, referenceNow);
    startDate = resolved.startDate;
    endDate = resolved.endDate;
  } else if (!startDate && !endDate) {
    // Por defecto: mes actual en la zona horaria del negocio
    const resolved = resolveQuickPeriodDates("this_month", timezone, referenceNow);
    startDate = resolved.startDate;
    endDate = resolved.endDate;
    quickPeriod = quickPeriod ?? "this_month";
  }

  if (!isValidISODateString(startDate) || !isValidISODateString(endDate)) {
    return {
      valid: false,
      error: {
        code: "INVALID_DATE_RANGE",
        message: "Las fechas deben tener el formato válido YYYY-MM-DD.",
      },
    };
  }

  if (startDate > endDate) {
    return {
      valid: false,
      error: {
        code: "INVALID_DATE_RANGE",
        message: "La fecha inicial no puede ser posterior a la fecha final.",
      },
    };
  }

  const daysCount = diffDaysInclusive(startDate, endDate);
  if (daysCount > MAX_REPORT_DAYS) {
    return {
      valid: false,
      error: {
        code: "DATE_RANGE_TOO_LARGE",
        message: `El rango seleccionado (${daysCount} días) supera el límite máximo permitido de ${MAX_REPORT_DAYS} días.`,
      },
    };
  }

  // Validar servicio
  const serviceId =
    typeof rawInput.serviceId === "string" && rawInput.serviceId.trim() !== ""
      ? rawInput.serviceId.trim()
      : null;

  if (serviceId && knownEntities?.serviceIds && !knownEntities.serviceIds.has(serviceId)) {
    return {
      valid: false,
      error: {
        code: "INVALID_FILTER",
        message: "El servicio seleccionado no existe en el catálogo.",
      },
    };
  }

  // Validar barbero
  const barberId =
    typeof rawInput.barberId === "string" && rawInput.barberId.trim() !== ""
      ? rawInput.barberId.trim()
      : null;

  if (barberId && knownEntities?.barberNames && !knownEntities.barberNames.has(barberId)) {
    return {
      valid: false,
      error: {
        code: "INVALID_FILTER",
        message: "El barbero seleccionado no está registrado en el sistema.",
      },
    };
  }

  // Validar método de pago
  const rawPaymentMethod =
    typeof rawInput.paymentMethod === "string" && rawInput.paymentMethod.trim() !== ""
      ? rawInput.paymentMethod.trim()
      : null;

  let paymentMethod: PaymentMethod | null = null;
  if (rawPaymentMethod) {
    if (!ALLOWED_PAYMENT_METHODS.includes(rawPaymentMethod as PaymentMethod)) {
      return {
        valid: false,
        error: {
          code: "INVALID_FILTER",
          message: "El método de pago indicado no es válido.",
        },
      };
    }
    paymentMethod = rawPaymentMethod as PaymentMethod;
  }

  // Validar estado del pago
  const rawPaymentStatus =
    typeof rawInput.paymentStatus === "string" && rawInput.paymentStatus.trim() !== ""
      ? rawInput.paymentStatus.trim()
      : null;

  let paymentStatus: PaymentStatus | null = null;
  if (rawPaymentStatus) {
    if (!ALLOWED_PAYMENT_STATUSES.includes(rawPaymentStatus as PaymentStatus)) {
      return {
        valid: false,
        error: {
          code: "INVALID_FILTER",
          message: "El estado de pago indicado no es válido.",
        },
      };
    }
    paymentStatus = rawPaymentStatus as PaymentStatus;
  }

  // Validar categoría de gasto
  const rawExpenseCategory =
    typeof rawInput.expenseCategoryId === "string" &&
    rawInput.expenseCategoryId.trim() !== ""
      ? rawInput.expenseCategoryId.trim()
      : null;

  let expenseCategoryId: ExpenseCategory | null = null;
  if (rawExpenseCategory) {
    if (!ALLOWED_EXPENSE_CATEGORIES.includes(rawExpenseCategory as ExpenseCategory)) {
      return {
        valid: false,
        error: {
          code: "INVALID_FILTER",
          message: "La categoría de gasto seleccionada no es válida.",
        },
      };
    }
    expenseCategoryId = rawExpenseCategory as ExpenseCategory;
  }

  // Validar ordenamiento contra lista blanca estricta
  const rawSortBy =
    typeof rawInput.sortBy === "string" && rawInput.sortBy.trim() !== ""
      ? rawInput.sortBy.trim()
      : "dateTime";

  if (!ALLOWED_SORT_FIELDS.includes(rawSortBy as TransactionSortField)) {
    return {
      valid: false,
      error: {
        code: "INVALID_FILTER",
        message: "El campo de ordenamiento solicitado no está permitido.",
      },
    };
  }
  const sortBy = rawSortBy as TransactionSortField;

  const rawSortOrder =
    typeof rawInput.sortOrder === "string" && rawInput.sortOrder.trim() !== ""
      ? rawInput.sortOrder.trim().toLowerCase()
      : "desc";

  if (!ALLOWED_SORT_DIRECTIONS.includes(rawSortOrder as SortDirection)) {
    return {
      valid: false,
      error: {
        code: "INVALID_FILTER",
        message: "La dirección de ordenamiento debe ser 'asc' o 'desc'.",
      },
    };
  }
  const sortOrder = rawSortOrder as SortDirection;

  // Paginación segura
  const parsedPage = Number(rawInput.page ?? 1);
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  const parsedPageSize = Number(rawInput.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize >= 1
      ? Math.min(MAX_PAGE_SIZE, Math.floor(parsedPageSize))
      : DEFAULT_PAGE_SIZE;

  return {
    valid: true,
    filters: {
      startDate,
      endDate,
      quickPeriod,
      barberId,
      serviceId,
      paymentMethod,
      paymentStatus,
      expenseCategoryId,
      branchId: null,
      page,
      pageSize,
      sortBy,
      sortOrder,
    },
  };
}
