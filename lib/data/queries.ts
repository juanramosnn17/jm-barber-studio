/* =====================================================================
   CONSULTAS DE DATOS (lib/data/queries.ts)
   ---------------------------------------------------------------------
   Todas las LECTURAS a la base de datos están aquí, en un solo lugar.
   Con API_URL lee SOLO de la API Spring Boot (tarea 4.9, contrato §8).
   Si no, y Supabase está configurado, lee SOLO de la base de datos remota
   (sin mezclar datos de ejemplo ni del store; si falla, devuelve vacío);
   si no, lee del store en memoria reactivo (modo demo). Tarea 3.16.
   ===================================================================== */

"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isApiConfigured } from "@/lib/api/config";
import { apiRequest } from "@/lib/api/client";
import {
  toAppointment,
  toBusinessHours,
  toProfile,
  toService,
  type ApiAppointment,
  type ApiBusinessHours,
  type ApiService,
  type ApiUser,
} from "@/lib/api/mappers";
import { minutesToTime, timeToMinutes, toISODate } from "@/lib/format";
import type { BookedRange } from "@/lib/schedule";
import { getSessionUserProfile } from "@/lib/auth/session";
import type {
  AppointmentStatus,
  AppointmentWithDetails,
  BusinessHours,
  Profile,
  Service,
  UserRole,
} from "@/lib/types";
import {
  getAllUsers,
  getClientNextAppointment,
  getStoredAppointments,
  getStoredBusinessHours,
  getStoredServices,
} from "./store";
import { mockAdmin, mockClient } from "./mock";

/** Forma de una fila de "appointments" cuando pedimos también sus relaciones. */
type AppointmentRow = {
  id: string;
  client_id: string;
  service_id: string;
  barber_name: string | null;
  chair: string | null;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes: string | null;
  service: { name: string; duration_label: string } | null;
  client: { first_name: string; last_name: string } | null;
};

/** Convierte una fila de Supabase en el formato que usan los componentes. */
function mapAppointment(row: AppointmentRow): AppointmentWithDetails {
  return {
    id: row.id,
    client_id: row.client_id,
    service_id: row.service_id,
    barber_name: row.barber_name ?? "Pendiente de asignación",
    chair: row.chair ?? "No asignado",
    date: row.date,
    time: row.time.slice(0, 5),
    status: row.status,
    notes: row.notes,
    service_name: row.service?.name ?? "Servicio",
    duration_label: row.service?.duration_label,
    client_name: row.client ? `${row.client.first_name} ${row.client.last_name}` : "Cliente",
  };
}

const APPOINTMENT_SELECT =
  "id, client_id, service_id, barber_name, chair, date, time, status, notes, service:services(name, duration_label), client:profiles(first_name, last_name)";

/* ---------------------------------------------------------------------
   USUARIO ACTUAL
   --------------------------------------------------------------------- */
const fetchCurrentProfile = cache(
  async (demoRoleFallback?: UserRole): Promise<Profile | null> => {
    // 0. Con la API Spring Boot, la sesión es el JWT de la cookie y el perfil sale de /auth/me
    if (isApiConfigured()) {
      const res = await apiRequest<ApiUser>("/auth/me");
      return res.ok ? toProfile(res.data) : null;
    }

    // 1. Con Supabase, la única fuente de sesión es Supabase Auth (se ignora la cookie demo)
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .single<Profile>();

      return profile ?? null;
    }

    // 2. Modo demo: sesión en la cookie local
    const sessionProfile = await getSessionUserProfile();
    if (sessionProfile) return sessionProfile;

    // 3. Fallback de rol si se solicitó explícitamente para previsualizaciones
    if (demoRoleFallback === "admin") return mockAdmin;
    if (demoRoleFallback === "cliente") return mockClient;

    return null;
  }
);

export async function getCurrentProfile(demoRoleFallback?: UserRole): Promise<Profile | null> {
  return fetchCurrentProfile(demoRoleFallback);
}

/* ---------------------------------------------------------------------
   SERVICIOS
   --------------------------------------------------------------------- */
export async function getServices(options: { onlyActive?: boolean } = {}): Promise<Service[]> {
  if (isApiConfigured()) {
    // La API devuelve los inactivos solo al admin; onlyActive=true los oculta también para él
    const res = await apiRequest<ApiService[]>(`/services${options.onlyActive ? "?onlyActive=true" : ""}`);
    if (!res.ok) {
      console.error("Error al leer servicios de la API:", res.message);
      return [];
    }
    return res.data.map(toService);
  }

  if (!isSupabaseConfigured()) {
    return getStoredServices(options.onlyActive);
  }

  const supabase = await createClient();
  let query = supabase.from("services").select("*").order("sort_order");
  if (options.onlyActive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.error("Error al leer servicios de Supabase:", error.message);
    return [];
  }
  return (data as Service[]) ?? [];
}

/* ---------------------------------------------------------------------
   PRÓXIMA CITA DEL CLIENTE
   --------------------------------------------------------------------- */
export async function getNextAppointment(clientId: string): Promise<AppointmentWithDetails | null> {
  if (isApiConfigured()) {
    // La API devuelve la del usuario del token (clientId no se envía: no se puede pedir la de otro)
    const res = await apiRequest<ApiAppointment>("/appointments/next");
    if (!res.ok) {
      console.error("Error al leer la próxima cita en la API:", res.message);
      return null;
    }
    return res.status === 204 ? null : toAppointment(res.data);
  }

  if (!isSupabaseConfigured()) {
    return getClientNextAppointment(clientId);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("client_id", clientId)
    .gte("date", toISODate(new Date()))
    .in("status", ["pendiente", "confirmada"])
    .order("date")
    .order("time")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error al leer la próxima cita en Supabase:", error.message);
    return null;
  }
  return data ? mapAppointment(data as unknown as AppointmentRow) : null;
}

/* ---------------------------------------------------------------------
   CITAS DEL DÍA (panel de administración y validación de disponibilidad)
   --------------------------------------------------------------------- */
export async function getAppointmentsByDate(date: string): Promise<AppointmentWithDetails[]> {
  if (isApiConfigured()) {
    // Agenda del día (solo admin y barbero; la API ya excluye las canceladas)
    const res = await apiRequest<ApiAppointment[]>(`/appointments?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      console.error("Error al leer la agenda en la API:", res.message);
      return [];
    }
    return res.data.map(toAppointment);
  }

  if (!isSupabaseConfigured()) {
    return getStoredAppointments(date).filter((a) => a.status !== "cancelada");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("date", date)
    .neq("status", "cancelada")
    .order("time");

  if (error) {
    console.error("Error al leer citas en Supabase:", error.message);
    return [];
  }

  const rows = (data as unknown as AppointmentRow[]) ?? [];

  // El barbero no lee profiles (RLS): los nombres llegan vacíos y se completan
  // con get_client_names, que solo devuelve nombre y apellido. Tarea 3.21.
  const missingIds = Array.from(new Set(rows.filter((r) => !r.client).map((r) => r.client_id)));
  if (missingIds.length > 0) {
    const { data: names, error: namesError } = await supabase.rpc("get_client_names", {
      p_ids: missingIds,
    });
    if (namesError) {
      console.error("Error al leer nombres de clientes en Supabase:", namesError.message);
    } else {
      const byId = new Map(
        ((names as { id: string; first_name: string; last_name: string }[]) ?? []).map((n) => [
          n.id,
          { first_name: n.first_name, last_name: n.last_name },
        ])
      );
      for (const r of rows) {
        if (!r.client) r.client = byId.get(r.client_id) ?? null;
      }
    }
  }

  return rows.map(mapAppointment);
}

/**
 * Rangos [inicio, fin) ya ocupados en una fecha, sin datos de nadie, para que el
 * BookingWizard solo ofrezca horas donde el servicio elegido cabe completo (tarea 4.12).
 */
export async function getBookedRangesByDate(date: string): Promise<BookedRange[]> {
  if (isApiConfigured()) {
    const res = await apiRequest<BookedRange[]>(`/appointments/booked-ranges?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      console.error("Error al leer horarios ocupados en la API:", res.message);
      return [];
    }
    return res.data;
  }

  // Con Supabase: get_booked_slots solo devuelve las horas de inicio (el esquema actual no
  // guarda el fin), así que cada una ocupa un turno (slot_minutes). Tarea 3.5 / 3.6.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_booked_slots", { p_date: date });
    if (error) {
      console.error("Error al leer horas ocupadas en Supabase:", error.message);
      return [];
    }
    const { slot_minutes } = await getBusinessHours();
    return ((data as string[] | null) ?? []).map((start) => ({
      start: start.slice(0, 5),
      end: minutesToTime(timeToMinutes(start.slice(0, 5)) + slot_minutes),
    }));
  }

  // Modo demo: el fin sale de la duración del servicio de cada cita
  const services = getStoredServices();
  return (await getAppointmentsByDate(date))
    .filter((a) => a.status !== "cancelada")
    .map((a) => {
      const minutes = services.find((s) => s.id === a.service_id)?.duration_minutes ?? 30;
      const start = a.time.slice(0, 5);
      return { start, end: minutesToTime(timeToMinutes(start) + minutes) };
    });
}

/* ---------------------------------------------------------------------
   HORARIO DE ATENCIÓN
   --------------------------------------------------------------------- */
export async function getBusinessHours(): Promise<BusinessHours> {
  if (isApiConfigured()) {
    const res = await apiRequest<ApiBusinessHours>("/business-hours");
    if (res.ok) return toBusinessHours(res.data);
    console.error("Error al leer el horario en la API:", res.message);
    return getStoredBusinessHours(); // horario por defecto para no romper la reserva
  }

  if (!isSupabaseConfigured()) {
    return getStoredBusinessHours();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("business_hours").select("*").eq("id", 1).maybeSingle();
  if (error || !data) {
    return getStoredBusinessHours();
  }

  return {
    ...(data as BusinessHours),
    open_time: String(data.open_time).slice(0, 5),
    close_time: String(data.close_time).slice(0, 5),
    break_start: data.break_start ? String(data.break_start).slice(0, 5) : null,
    break_end: data.break_end ? String(data.break_end).slice(0, 5) : null,
  };
}

/* ---------------------------------------------------------------------
   USUARIOS
   --------------------------------------------------------------------- */
export async function getProfilesPage(
  page: number,
  pageSize: number
): Promise<{ rows: Profile[]; total: number }> {
  const safePage = Math.max(1, Math.floor(page || 1));
  const safePageSize = Math.max(1, Math.floor(pageSize || 6));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  if (isApiConfigured()) {
    const res = await apiRequest<{ rows: ApiUser[]; total: number }>(
      `/users?page=${safePage}&size=${safePageSize}`
    );
    if (!res.ok) {
      console.error("Error al leer usuarios en la API:", res.message);
      return { rows: [], total: 0 };
    }
    return { rows: res.data.rows.map(toProfile), total: res.data.total };
  }

  if (!isSupabaseConfigured()) {
    const all = getAllUsers();
    return { rows: all.slice(from, to + 1), total: all.length };
  }

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("role", { ascending: true })
    .order("first_name")
    .range(from, to);

  if (error) {
    console.error("Error al leer usuarios en Supabase:", error.message);
    return { rows: [], total: 0 };
  }
  return { rows: (data as Profile[]) ?? [], total: count ?? 0 };
}

export async function getClientCount(): Promise<number> {
  if (isApiConfigured()) {
    const res = await apiRequest<{ total: number }>("/users?role=CLIENTE&size=1");
    return res.ok ? res.data.total : 0;
  }

  if (!isSupabaseConfigured()) {
    return getAllUsers().filter((u) => u.role === "cliente").length;
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "cliente");

  if (error) {
    console.error("Error al contar clientes en Supabase:", error.message);
    return 0;
  }
  return count ?? 0;
}

