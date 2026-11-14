/* =====================================================================
   REPOSITORIO DE DATOS CONTABLES (lib/accounting/profit-report.repository.ts)
   ---------------------------------------------------------------------
   Centraliza las lecturas para el reporte de ganancias desde Supabase
   (cuando está configurado) y el almacén local, ejecutando consultas
   independientes en paralelo y sin duplicar registros.
   ===================================================================== */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionUserProfile } from "@/lib/auth/session";
import {
  getAllStoredAppointments,
  getAllUsers,
  getStoredExpenses,
  getStoredServices,
} from "@/lib/data/store";
import type {
  AppointmentStatus,
  AppointmentWithDetails,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  PaymentMethod,
  PaymentStatus,
  Profile,
  Service,
} from "@/lib/types";
import { deduplicateById } from "./profit-report.calculations";

type SupabaseAppointmentAccountingRow = {
  id: string;
  client_id: string;
  service_id: string;
  barber_name: string | null;
  chair: string | null;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes: string | null;
  payment_status?: PaymentStatus | null;
  payment_method?: PaymentMethod | null;
  gross_amount?: number | string | null;
  discount_amount?: number | string | null;
  refund_amount?: number | string | null;
  tip_amount?: number | string | null;
  direct_cost_amount?: number | string | null;
  commission_amount?: number | string | null;
  reserve_amount?: number | string | null;
  paid_at?: string | null;
  created_at?: string;
  service: { name: string; duration_label: string; price?: number } | null;
  client: { first_name: string; last_name: string } | null;
};

type SupabaseExpenseRow = {
  id: string;
  date: string;
  time: string | null;
  category: ExpenseCategory;
  concept: string;
  amount: number | string;
  payment_method: PaymentMethod;
  status: ExpenseStatus;
  reference: string | null;
  notes: string | null;
  void_reason?: string | null;
  voided_at?: string | null;
  created_at?: string;
};

const ACCOUNTING_APPOINTMENT_SELECT =
  "id, client_id, service_id, barber_name, chair, date, time, status, notes, payment_status, payment_method, gross_amount, discount_amount, refund_amount, tip_amount, direct_cost_amount, commission_amount, reserve_amount, paid_at, created_at, service:services(name, duration_label, price), client:profiles(first_name, last_name)";

function mapAccountingAppointment(
  row: SupabaseAppointmentAccountingRow
): AppointmentWithDetails {
  const status = row.status;
  const fallbackPaymentStatus: PaymentStatus =
    row.payment_status ??
    (status === "completada"
      ? "pagado"
      : status === "cancelada"
      ? "anulado"
      : "pendiente");

  return {
    id: row.id,
    client_id: row.client_id,
    service_id: row.service_id,
    barber_name: row.barber_name ?? "Sin asignar",
    chair: row.chair ?? "No asignado",
    date: row.date,
    time: String(row.time).slice(0, 5),
    status,
    notes: row.notes,
    payment_status: fallbackPaymentStatus,
    payment_method:
      row.payment_method ?? (fallbackPaymentStatus === "pagado" ? "efectivo" : null),
    gross_amount:
      row.gross_amount !== null && row.gross_amount !== undefined
        ? Number(row.gross_amount)
        : row.service?.price ?? null,
    discount_amount:
      row.discount_amount !== null && row.discount_amount !== undefined
        ? Number(row.discount_amount)
        : 0,
    refund_amount:
      row.refund_amount !== null && row.refund_amount !== undefined
        ? Number(row.refund_amount)
        : 0,
    tip_amount:
      row.tip_amount !== null && row.tip_amount !== undefined
        ? Number(row.tip_amount)
        : 0,
    direct_cost_amount:
      row.direct_cost_amount !== null && row.direct_cost_amount !== undefined
        ? Number(row.direct_cost_amount)
        : null,
    commission_amount:
      row.commission_amount !== null && row.commission_amount !== undefined
        ? Number(row.commission_amount)
        : null,
    reserve_amount:
      row.reserve_amount !== null && row.reserve_amount !== undefined
        ? Number(row.reserve_amount)
        : null,
    paid_at: row.paid_at ?? null,
    created_at: row.created_at,
    service_name: row.service?.name ?? "Servicio",
    duration_label: row.service?.duration_label,
    client_name: row.client
      ? `${row.client.first_name} ${row.client.last_name}`.trim()
      : "Cliente",
  };
}

function mapExpenseRow(row: SupabaseExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date,
    time: row.time ? String(row.time).slice(0, 5) : "12:00",
    category: row.category,
    concept: row.concept,
    amount: Number(row.amount),
    payment_method: row.payment_method,
    status: row.status,
    reference: row.reference,
    notes: row.notes,
    void_reason: row.void_reason ?? null,
    voided_at: row.voided_at ?? null,
    created_at: row.created_at,
  };
}

/**
 * Obtiene el perfil autenticado real sin aplicar ningún fallback ficticio.
 * Así se garantiza que usuarios no autenticados o con rol distinto de 'admin'
 * sean rechazados en el servidor.
 */
export async function getAuthenticatedProfile(): Promise<Profile | null> {
  // Modo demo: sesión en la cookie local. Con Supabase la cookie demo se ignora (tarea 3.16).
  if (!isSupabaseConfigured()) {
    return getSessionUserProfile();
  }

  {
    try {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .single<Profile>();

      return profile ?? null;
    } catch {
      return null;
    }
  }
}

export interface AccountingRepositoryDataset {
  appointments: AppointmentWithDetails[];
  expenses: Expense[];
  services: Service[];
  barberNames: string[];
  operatingExpensesSourceAvailable: boolean;
}

/**
 * Obtiene en paralelo las citas, gastos operativos, catálogo de servicios y lista de barberos
 * para el rango que abarca desde `earliestDate` hasta `latestDate`.
 */
export async function fetchAccountingDataset(
  earliestDate: string,
  latestDate: string
): Promise<AccountingRepositoryDataset> {
  if (!isSupabaseConfigured()) {
    const localAppointments = getAllStoredAppointments().filter(
      (a) => a.date >= earliestDate && a.date <= latestDate
    );
    const localExpenses = getStoredExpenses().filter(
      (e) => e.date >= earliestDate && e.date <= latestDate
    );
    const localServices = getStoredServices(false);
    const localUsers = getAllUsers();
    const barberSet = new Set<string>();
    for (const u of localUsers) {
      if (u.role === "barbero") {
        barberSet.add(`${u.first_name} ${u.last_name}`.trim());
      }
    }
    for (const app of getAllStoredAppointments()) {
      if (
        app.barber_name &&
        app.barber_name !== "Pendiente de asignación" &&
        app.barber_name !== "Sin asignar"
      ) {
        barberSet.add(app.barber_name.trim());
      }
    }

    return {
      appointments: deduplicateById(localAppointments),
      expenses: deduplicateById(localExpenses),
      services: localServices,
      barberNames: Array.from(barberSet).sort(),
      operatingExpensesSourceAvailable: true,
    };
  }

  // Consultas paralelas a Supabase
  const supabase = await createClient();
  const [appointmentsRes, expensesRes, servicesRes, barbersRes] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(ACCOUNTING_APPOINTMENT_SELECT)
        .gte("date", earliestDate)
        .lte("date", latestDate)
        .order("date", { ascending: false })
        .order("time", { ascending: false }),
      supabase
        .from("expenses")
        .select("*")
        .gte("date", earliestDate)
        .lte("date", latestDate)
        .order("date", { ascending: false }),
      supabase.from("services").select("*").order("sort_order"),
      supabase
        .from("profiles")
        .select("first_name, last_name, role")
        .eq("role", "barbero"),
    ]);

  // Con Supabase solo se usan datos de la base (sin mezclar store/mock). Tarea 3.16.
  for (const res of [appointmentsRes, expensesRes, servicesRes, barbersRes]) {
    if (res.error) console.error("Error al leer datos contables en Supabase:", res.error.message);
  }

  const mergedAppointments: AppointmentWithDetails[] =
    !appointmentsRes.error && appointmentsRes.data
      ? (
          appointmentsRes.data as unknown as SupabaseAppointmentAccountingRow[]
        ).map(mapAccountingAppointment)
      : [];

  const operatingExpensesSourceAvailable = !expensesRes.error;
  const mergedExpenses: Expense[] =
    !expensesRes.error && expensesRes.data
      ? (expensesRes.data as unknown as SupabaseExpenseRow[]).map(mapExpenseRow)
      : [];

  const services: Service[] =
    !servicesRes.error && servicesRes.data
      ? (servicesRes.data as Service[]).map((s) => ({
          ...s,
          price: Number(s.price),
          reserve_amount: Number(s.reserve_amount ?? 0),
          direct_cost:
            s.direct_cost !== undefined && s.direct_cost !== null
              ? Number(s.direct_cost)
              : Math.round(Number(s.price) * 0.1),
          commission_percentage:
            s.commission_percentage !== undefined &&
            s.commission_percentage !== null
              ? Number(s.commission_percentage)
              : 40,
        }))
      : [];

  const barberSet = new Set<string>();
  if (!barbersRes.error && barbersRes.data) {
    for (const b of barbersRes.data) {
      barberSet.add(`${b.first_name} ${b.last_name}`.trim());
    }
  }
  for (const app of mergedAppointments) {
    if (
      app.barber_name &&
      app.barber_name !== "Pendiente de asignación" &&
      app.barber_name !== "Sin asignar"
    ) {
      barberSet.add(app.barber_name.trim());
    }
  }

  return {
    appointments: mergedAppointments,
    expenses: mergedExpenses,
    services,
    barberNames: Array.from(barberSet).sort(),
    operatingExpensesSourceAvailable,
  };
}
