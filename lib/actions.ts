/* =====================================================================
   ACCIONES DE SERVIDOR (lib/actions.ts)
   ---------------------------------------------------------------------
   Este archivo contiene las mutaciones y acciones invocables desde
   los componentes en React (Server Actions).
   Gestiona:
     - Registro de usuarios con inicio de sesión inmediato
     - Inicio de sesión con validación de roles y redirección coherente
     - Cierre de sesión
     - Creación de citas y redirección con confirmación
     - Actualización de estado de citas
     - Guardado y actualización de horarios de atención (admin -> cliente)
     - Creación y activación de servicios (admin -> cliente)

   Modo de datos (tareas 3.12, 3.16 y 4.9):
     - Con API_URL, cada acción llama SOLO a la API Spring Boot y devuelve
       su mensaje de error en español (contrato §8).
     - Si no, con Supabase configurado, cada acción escribe SOLO en Supabase y
       revisa el resultado: si hay error o no se afectó ninguna fila
       (por ejemplo, porque RLS lo impidió), responde { ok: false }.
     - Sin Supabase (modo demo), escribe en el store en memoria.
   ===================================================================== */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { clearSessionUser, getSessionUserProfile, setSessionUser } from "@/lib/auth/session";
import { getBusinessHours, getCurrentProfile } from "@/lib/data/queries";
import { isApiConfigured } from "@/lib/api/config";
import { apiRequest, clearApiToken, setApiToken } from "@/lib/api/client";
import { fromBusinessHours, upper, type ApiAppointment, type ApiUser } from "@/lib/api/mappers";
import { isPastSlot } from "@/lib/schedule";
import { safeReturnPath } from "@/lib/safe-redirect";
import {
  addStoredAppointment,
  addStoredExpense,
  addStoredService,
  findUserByCredentials,
  getAllStoredAppointments,
  getStoredAppointments,
  registerNewUser,
  toggleStoredServiceActive,
  updateStoredAppointmentStatus,
  updateStoredBusinessHours,
  getStoredServices,
  updateStoredService,
  updateStoredUser,
  deleteStoredUser,
  findStoredExpense,
  updateStoredExpense,
  voidStoredExpense,
  deleteStoredExpense,
  updateStoredAppointmentPayment,
  updateStoredServiceReserve,
} from "@/lib/data/store";
import type {
  ActionResult,
  AppointmentStatus,
  BusinessHours,
  ExpenseCategory,
  PaymentMethod,
  Service,
  UserRole,
} from "./types";

const SLOT_TAKEN_MESSAGE = "Este bloque horario ya está ocupado. Por favor elige otro turno.";
const SAVE_ERROR_MESSAGE =
  "No se pudo guardar el cambio. Verifica tus permisos o inténtalo de nuevo.";

const FORBIDDEN_MESSAGE = "No tienes permisos para realizar esta acción.";

/**
 * Validación de rol en el servidor (tarea 3.13). Las Server Actions se pueden
 * invocar con un POST directo, así que proteger la página no basta.
 * Devuelve el perfil si su rol está permitido, o null si no.
 */
async function requireRole(allowed: UserRole[]) {
  const profile = await getCurrentProfile();
  if (!profile || !allowed.includes(profile.role)) return null;
  return profile;
}

/** Mensaje para funciones que solo existen en el backend Spring Boot (contrato §8). */
const API_ONLY_MESSAGE = "Esta función requiere el backend Spring Boot (API_URL).";

/** Pesos enteros desde un campo del formulario o un número ("" o inválido → 0). */
function toPesos(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : 0;
}

/** Registra el error de Supabase en el servidor y devuelve un resultado fallido. */
function supabaseFailure(context: string, detail?: string): ActionResult {
  console.error(`${context}:`, detail ?? "ninguna fila afectada");
  return { ok: false, message: SAVE_ERROR_MESSAGE };
}

/**
 * Iniciar sesión de usuario
 */
export async function loginAction(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const emailOrPhone = formData.get("identifier") as string;
  const password = formData.get("password") as string;
  // Solo destinos internos (sin "//", "\" ni otro origen): evita un open redirect (tarea 4.13)
  const safeReturnUrl = safeReturnPath(formData.get("return_url"));

  if (!emailOrPhone || !password) {
    return { ok: false, message: "Por favor ingresa correo o teléfono y tu contraseña." };
  }

  // 0. Con la API Spring Boot: el token se guarda en la cookie httpOnly
  if (isApiConfigured()) {
    const res = await apiRequest<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      body: { email: emailOrPhone.trim(), password },
    });
    if (!res.ok) return { ok: false, message: res.message };
    await setApiToken(res.data.token);
    if (safeReturnUrl) redirect(safeReturnUrl);
    const role = res.data.user.role;
    redirect(role === "ADMIN" || role === "BARBERO" ? "/admin" : "/cliente");
  }

  // 1. Con Supabase: solo Supabase Auth (sin respaldo en el store local)
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailOrPhone,
      password,
    });

    if (error || !data.user) {
      return {
        ok: false,
        message: "Credenciales incorrectas. Verifica tu correo y contraseña o regístrate si aún no tienes cuenta.",
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (safeReturnUrl) redirect(safeReturnUrl);
    redirect(profile?.role === "admin" || profile?.role === "barbero" ? "/admin" : "/cliente");
  }

  // 2. Modo demo: verificación contra el Store en memoria
  const localUser = findUserByCredentials(emailOrPhone, password);
  if (!localUser) {
    return {
      ok: false,
      message: "Credenciales incorrectas. Verifica tu correo y contraseña o regístrate si aún no tienes cuenta.",
    };
  }

  // Establecer sesión en cookie
  await setSessionUser(localUser.id);

  if (safeReturnUrl) {
    redirect(safeReturnUrl);
  }

  if (localUser.role === "admin" || localUser.role === "barbero") {
    redirect("/admin");
  } else {
    redirect("/cliente");
  }
}

/**
 * Registrar nuevo cliente
 */
export async function registerAction(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!firstName || !email || !password) {
    return { ok: false, message: "Por favor completa todos los campos obligatorios." };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "Las contraseñas no coinciden." };
  }

  // 0. Con la API Spring Boot: el rol siempre es CLIENTE (lo fija la API) y se inicia sesión de inmediato
  if (isApiConfigured()) {
    const res = await apiRequest<{ token: string; user: ApiUser }>("/auth/register", {
      method: "POST",
      body: {
        firstName: firstName.trim(),
        lastName: (lastName || "").trim(),
        email: email.trim(),
        phone: phone ? `+57 ${phone.trim()}` : null,
        password,
        confirmPassword,
        acceptsDataUse: formData.get("terms") === "on",
      },
    });
    if (!res.ok) return { ok: false, message: res.message };
    await setApiToken(res.data.token);
    revalidatePath("/");
    revalidatePath("/cliente");
    redirect("/cliente");
  }

  // 1. Con Supabase: registrar solo en Auth (el trigger crea el perfil como 'cliente')
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName || "",
          phone: phone ? `+57 ${phone.trim()}` : null,
        },
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }
    if (!authData.session) {
      return {
        ok: false,
        message: "Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.",
      };
    }

    revalidatePath("/");
    revalidatePath("/cliente");
    redirect("/cliente");
  }

  // 2. Modo demo: registrar en store local
  try {
    const newUser = registerNewUser({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone ? `+57 ${phone.trim()}` : null,
      password,
      role: "cliente",
    });

    await setSessionUser(newUser.id);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { ok: false, message: err.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/cliente");
  redirect("/cliente");
}

/**
 * Cerrar sesión
 */
export async function logoutAction() {
  await clearSessionUser();
  await clearApiToken(); // JWT de la API: el token deja de enviarse desde este navegador

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      // Solo este dispositivo: el alcance global cerraba la sesión de esa
      // cuenta en todos los navegadores (tarea 3.19).
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignorar error al limpiar
    }
  }

  revalidatePath("/");
  redirect("/login");
}

/**
 * Crear una nueva reserva de cita
 */
export async function createAppointmentAction(
  serviceId: string,
  date: string,
  time: string,
  notes?: string
): Promise<{ ok: boolean; message?: string; appointmentId?: string }> {
  if (!serviceId || !date || !time) {
    return { ok: false, message: "Faltan datos requeridos de la reserva." };
  }

  const normalizedTime = time.trim().slice(0, 5);

  // No se reserva en el pasado (hora de Colombia). Tarea 3.18 / spec F2.
  if (isPastSlot(date, normalizedTime)) {
    return { ok: false, message: "No puedes reservar en una fecha u hora que ya pasó." };
  }

  // 0. Con la API Spring Boot: la API valida el horario, el pasado y el turno ocupado (409)
  if (isApiConfigured()) {
    const res = await apiRequest<ApiAppointment>("/appointments", {
      method: "POST",
      body: { serviceId, date, time: normalizedTime, notes: notes?.trim() || null },
    });
    if (!res.ok) return { ok: false, message: res.message };
    revalidatePath("/cliente");
    revalidatePath("/admin");
    return { ok: true, message: "¡Tu cita ha sido reservada exitosamente!", appointmentId: res.data.id };
  }

  const defaultBarber = "Pendiente de asignación";
  const defaultChair = "No asignado";

  // 1. Con Supabase: la cita se guarda solo en la base de datos
  if (isSupabaseConfigured()) {
    const user = await getCurrentProfile();
    if (!user) {
      return { ok: false, message: "Debes iniciar sesión para reservar." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        client_id: user.id,
        service_id: serviceId,
        barber_name: defaultBarber,
        chair: defaultChair,
        date,
        time: normalizedTime,
        status: "confirmada",
        notes: notes || null,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 = violación de unicidad (bloque ya ocupado; índice de la tarea 3.4)
      if (error.code === "23505") return { ok: false, message: SLOT_TAKEN_MESSAGE };
      console.error("Error al crear la cita en Supabase:", error.message);
      return { ok: false, message: "No se pudo reservar la cita. Inténtalo de nuevo." };
    }

    revalidatePath("/cliente");
    revalidatePath("/admin");
    return {
      ok: true,
      message: "¡Tu cita ha sido reservada exitosamente!",
      appointmentId: data.id,
    };
  }

  // 2. Modo demo: store en memoria
  const existingLocal = getStoredAppointments(date).some(
    (a) => a.time.slice(0, 5) === normalizedTime && a.status !== "cancelada"
  );
  if (existingLocal) {
    return { ok: false, message: SLOT_TAKEN_MESSAGE };
  }

  const user = await getSessionUserProfile();
  const clientId = user?.id || "usr-anonimo";
  const clientName = user ? `${user.first_name} ${user.last_name}`.trim() : "Cliente";

  const srv = getStoredServices().find((s) => s.id === serviceId);

  const newApp = addStoredAppointment({
    client_id: clientId,
    client_name: clientName,
    service_id: serviceId,
    service_name: srv?.name || "Servicio",
    duration_label: srv?.duration_label || "40 min",
    barber_name: defaultBarber,
    chair: defaultChair,
    date,
    time: normalizedTime,
    notes,
  });

  revalidatePath("/cliente");
  revalidatePath("/admin");
  return {
    ok: true,
    message: "¡Tu cita ha sido reservada exitosamente!",
    appointmentId: newApp.id,
  };
}

/**
 * Actualizar estado de una cita (Aprobar, Rechazar, Completar)
 */
export async function updateAppointmentStatusAction(
  appointmentId: string,
  newStatus: AppointmentStatus
): Promise<ActionResult> {
  // admin y barbero: cualquier estado · cliente: solo cancelar sus propias citas
  const user = await requireRole(["admin", "barbero", "cliente"]);
  if (!user) return { ok: false, message: FORBIDDEN_MESSAGE };
  if (user.role === "cliente") {
    if (newStatus !== "cancelada") return { ok: false, message: FORBIDDEN_MESSAGE };
    // En la API y en Supabase el servidor limita al cliente a sus propias citas; en demo se verifica aquí.
    if (!isApiConfigured() && !isSupabaseConfigured()) {
      const own = getAllStoredAppointments().some(
        (a) => a.id === appointmentId && a.client_id === user.id
      );
      if (!own) return { ok: false, message: FORBIDDEN_MESSAGE };
    }
  }

  if (isApiConfigured()) {
    // Al completar, la API fija el pago en efectivo y la reserva del servicio
    const res = await apiRequest(`/appointments/${encodeURIComponent(appointmentId)}/status`, {
      method: "PATCH",
      body: { status: upper(newStatus) },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === "completada") {
      updatePayload.payment_status = "pagado";
      updatePayload.payment_method = "efectivo";
      updatePayload.paid_at = new Date().toISOString();
      // Fijar la reserva del servicio en la cita (tarea 3.27); sin comisión
      const { data: appRow } = await supabase
        .from("appointments")
        .select("service:services(reserve_amount)")
        .eq("id", appointmentId)
        .maybeSingle();
      const svc = appRow?.service as unknown as { reserve_amount: number | string } | null;
      updatePayload.reserve_amount = Number(svc?.reserve_amount ?? 0);
      updatePayload.commission_amount = 0;
    } else if (newStatus === "cancelada") {
      updatePayload.payment_status = "anulado";
    }
    const { data, error } = await supabase
      .from("appointments")
      .update(updatePayload)
      .eq("id", appointmentId)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error actualizando cita en Supabase", error?.message);
    }
  } else {
    updateStoredAppointmentStatus(appointmentId, newStatus);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/contabilidad/ganancias");
  revalidatePath("/cliente");
  return { ok: true };
}

/**
 * Guardar horario de atención (Admin -> Cliente de inmediato)
 */
export async function updateBusinessHoursAction(
  hoursData: Partial<BusinessHours>
): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }

  // Validación en servidor según docs/contratos/api.md y docs/datos/modelo.md (T-B4)
  const current = await getBusinessHours();
  const merged: BusinessHours = {
    ...current,
    ...hoursData,
    open_days: hoursData.open_days
      ? Array.from(new Set(hoursData.open_days.map((d) => Math.trunc(Number(d)))))
      : current.open_days,
    open_time: (hoursData.open_time ?? current.open_time).trim().slice(0, 5),
    close_time: (hoursData.close_time ?? current.close_time).trim().slice(0, 5),
    break_start:
      hoursData.break_start === undefined
        ? current.break_start
        : hoursData.break_start?.trim().slice(0, 5) || null,
    break_end:
      hoursData.break_end === undefined
        ? current.break_end
        : hoursData.break_end?.trim().slice(0, 5) || null,
    slot_minutes:
      hoursData.slot_minutes === undefined
        ? current.slot_minutes
        : Math.round(Number(hoursData.slot_minutes)),
  };

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const invalidDays =
    merged.open_days.length === 0 ||
    merged.open_days.some((d) => !Number.isInteger(d) || d < 0 || d > 6);
  const invalidTimes =
    !timePattern.test(merged.open_time) ||
    !timePattern.test(merged.close_time) ||
    merged.open_time >= merged.close_time;
  const hasBreakStart = Boolean(merged.break_start);
  const hasBreakEnd = Boolean(merged.break_end);
  const invalidBreak =
    hasBreakStart !== hasBreakEnd ||
    (hasBreakStart &&
      hasBreakEnd &&
      (!timePattern.test(merged.break_start!) ||
        !timePattern.test(merged.break_end!) ||
        merged.break_start! < merged.open_time ||
        merged.break_start! >= merged.break_end! ||
        merged.break_end! > merged.close_time));
  const invalidSlot =
    !Number.isFinite(merged.slot_minutes) ||
    merged.slot_minutes < 10 ||
    merged.slot_minutes > 120;

  if (invalidDays || invalidTimes || invalidBreak || invalidSlot) {
    return {
      ok: false,
      message: "Revisa los días, el horario de atención, el almuerzo y la duración de los bloques.",
    };
  }

  const sanitizedUpdate = {
    open_days: merged.open_days,
    open_time: merged.open_time,
    close_time: merged.close_time,
    break_start: merged.break_start,
    break_end: merged.break_end,
    slot_minutes: merged.slot_minutes,
  };

  if (isApiConfigured()) {
    const res = await apiRequest("/business-hours", {
      method: "PUT",
      body: fromBusinessHours(merged),
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_hours")
      .update(sanitizedUpdate)
      .eq("id", 1)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error guardando horario en Supabase", error?.message);
    }
  } else {
    updateStoredBusinessHours(sanitizedUpdate);
  }

  revalidatePath("/cliente");
  revalidatePath("/admin");
  revalidatePath("/admin/horarios");
  return { ok: true, message: "Horarios actualizados correctamente." };
}

/**
 * Alternar visibilidad de un servicio (Activar / Desactivar)
 */
export async function toggleServiceActiveAction(serviceId: string): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }

  if (isApiConfigured()) {
    const res = await apiRequest(`/services/${encodeURIComponent(serviceId)}/active`, { method: "PATCH" });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("services")
      .select("is_active")
      .eq("id", serviceId)
      .maybeSingle();
    if (readError || !current) {
      return supabaseFailure("Error leyendo servicio en Supabase", readError?.message);
    }
    const { data, error } = await supabase
      .from("services")
      .update({ is_active: !current.is_active })
      .eq("id", serviceId)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error actualizando servicio en Supabase", error?.message);
    }
  } else {
    toggleStoredServiceActive(serviceId);
  }

  revalidatePath("/");
  revalidatePath("/cliente");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Agregar un nuevo servicio al catálogo (Admin -> Cliente)
 */
export async function createServiceAction(
  formData: FormData
): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }

  const name = ((formData.get("name") as string) ?? "").trim();
  const shortName = ((formData.get("short_name") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim();
  const includes = ((formData.get("includes") as string) ?? "").trim();
  const price = Math.round(Number(formData.get("price")));
  const reserveRaw = formData.get("reserve_amount");
  const reserveAmount = reserveRaw === null || reserveRaw === "" ? 0 : Math.round(Number(reserveRaw));
  const durationMinutes = Math.round(Number(formData.get("duration_minutes")));
  const durationLabel =
    ((formData.get("duration_label") as string) ?? "").trim() ||
    (Number.isFinite(durationMinutes) && durationMinutes > 0 ? `${durationMinutes} min` : "30 min");
  const icon = ((formData.get("icon") as string) ?? "").trim() || "content_cut";
  let imageUrl =
    ((formData.get("image_url") as string) ?? "").trim() || "/images/servicios/corte-cabello.jpg";

  const customImg = ((formData.get("custom_image_url") as string) ?? "").trim();
  if (customImg.length > 0) {
    imageUrl = customImg;
  }

  if (!name || !Number.isFinite(price) || price <= 0) {
    return { ok: false, message: "Nombre y precio válido son obligatorios." };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, message: "La duración debe ser mayor a cero minutos." };
  }
  if (!Number.isFinite(reserveAmount) || reserveAmount < 0 || reserveAmount > price) {
    return { ok: false, message: "La reserva debe estar entre $0 y el precio del servicio." };
  }

  const newServiceData: Omit<Service, "id" | "sort_order"> = {
    name,
    short_name: shortName || name,
    description: description || "Servicio profesional de cuidado masculino.",
    includes: includes || null,
    price,
    reserve_amount: reserveAmount,
    duration_label: durationLabel,
    duration_minutes: durationMinutes,
    image_url: imageUrl,
    icon,
    is_active: true,
  };

  if (isApiConfigured()) {
    const res = await apiRequest("/services", {
      method: "POST",
      body: {
        name: newServiceData.name,
        shortName: newServiceData.short_name,
        description: newServiceData.description,
        includes: newServiceData.includes,
        price: newServiceData.price,
        durationLabel: newServiceData.duration_label,
        durationMinutes: newServiceData.duration_minutes,
        icon: newServiceData.icon,
        imageUrl: newServiceData.image_url,
        reserveAmount: newServiceData.reserve_amount ?? 0, // antes se perdía (verificación 4.10)
      },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("services").insert(newServiceData).select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error insertando servicio en Supabase", error?.message);
    }
  } else {
    addStoredService(newServiceData);
  }

  revalidatePath("/");
  revalidatePath("/cliente");
  revalidatePath("/admin");
  revalidatePath("/admin/servicios");
  return { ok: true, message: "Servicio creado exitosamente." };
}

/**
 * Editar un servicio existente (nombre, precio, duración, reserva, imagen).
 * Solo afecta reservas y cobros nuevos; el historial conserva sus valores congelados (T-B4).
 */
export async function updateServiceAction(
  serviceId: string,
  formData: FormData
): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }
  if (!serviceId?.trim()) {
    return { ok: false, message: "No se encontró el servicio." };
  }

  const name = ((formData.get("name") as string) ?? "").trim();
  const shortName = ((formData.get("short_name") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim();
  const includes = ((formData.get("includes") as string) ?? "").trim();
  const price = Math.round(Number(formData.get("price")));
  const reserveRaw = formData.get("reserve_amount");
  const reserveAmount = reserveRaw === null || reserveRaw === "" ? 0 : Math.round(Number(reserveRaw));
  const durationMinutes = Math.round(Number(formData.get("duration_minutes")));
  const durationLabel =
    ((formData.get("duration_label") as string) ?? "").trim() ||
    (Number.isFinite(durationMinutes) && durationMinutes > 0 ? `${durationMinutes} min` : "30 min");
  const icon = ((formData.get("icon") as string) ?? "").trim() || "content_cut";
  let imageUrl =
    ((formData.get("image_url") as string) ?? "").trim() || "/images/servicios/corte-cabello.jpg";

  const customImg = ((formData.get("custom_image_url") as string) ?? "").trim();
  if (customImg.length > 0) {
    imageUrl = customImg;
  }

  if (!name || !Number.isFinite(price) || price <= 0) {
    return { ok: false, message: "Nombre y precio válido son obligatorios." };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, message: "La duración debe ser mayor a cero minutos." };
  }
  if (!Number.isFinite(reserveAmount) || reserveAmount < 0 || reserveAmount > price) {
    return { ok: false, message: "La reserva debe estar entre $0 y el precio del servicio." };
  }

  const changes = {
    name,
    short_name: shortName || name,
    description: description || "Servicio profesional de cuidado masculino.",
    includes: includes || null,
    price,
    reserve_amount: reserveAmount,
    duration_label: durationLabel,
    duration_minutes: durationMinutes,
    image_url: imageUrl,
    icon,
  };

  if (isApiConfigured()) {
    const res = await apiRequest(`/services/${encodeURIComponent(serviceId)}`, {
      method: "PUT",
      body: {
        name: changes.name,
        shortName: changes.short_name,
        description: changes.description,
        includes: changes.includes,
        price: changes.price,
        reserveAmount: changes.reserve_amount,
        durationLabel: changes.duration_label,
        durationMinutes: changes.duration_minutes,
        icon: changes.icon,
        imageUrl: changes.image_url,
      },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .update(changes)
      .eq("id", serviceId)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error actualizando servicio en Supabase", error?.message);
    }
  } else {
    const updated = updateStoredService(serviceId, changes);
    if (!updated) return { ok: false, message: "No se encontró el servicio." };
  }

  revalidatePath("/");
  revalidatePath("/cliente");
  revalidatePath("/admin");
  revalidatePath("/admin/servicios");
  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Servicio actualizado correctamente." };
}

/**
 * Actualizar datos de un usuario (Admin)
 */
export async function updateUserAction(
  userId: string,
  data: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    role: "cliente" | "barbero" | "admin";
  }
): Promise<ActionResult> {
  const admin = await requireRole(["admin"]);
  if (!admin) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }
  if (userId === admin.id && data.role !== "admin") {
    return { ok: false, message: "No puedes quitarte a ti mismo el rol de administrador." };
  }
  if (!userId || !data.first_name || !data.email) {
    return { ok: false, message: "Nombre y correo son obligatorios." };
  }

  if (isApiConfigured()) {
    const res = await apiRequest(`/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: {
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        phone: data.phone || null,
        role: upper(data.role),
      },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || null,
        role: data.role,
      })
      .eq("id", userId)
      .select("id");
    if (error || !rows?.length) {
      return supabaseFailure("Error actualizando perfil en Supabase", error?.message);
    }
  } else {
    updateStoredUser(userId, data);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Usuario actualizado correctamente." };
}

/**
 * Eliminar un usuario (Admin)
 */
export async function deleteUserAction(userId: string): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }
  if (!userId) {
    return { ok: false, message: "ID de usuario inválido." };
  }

  if (isApiConfigured()) {
    // La API rechaza con 409 que el admin se elimine a sí mismo; sus citas se borran en cascada
    const res = await apiRequest(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!res.ok) return { ok: false, message: res.message };
    revalidatePath("/admin");
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario eliminado con éxito." };
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    // delete_user borra la cuenta en auth.users (y en cascada su perfil). Tarea 3.11.
    const { error } = await supabase.rpc("delete_user", { p_user_id: userId });
    if (error) {
      console.error("Error eliminando usuario en Supabase:", error.message);
      const message =
        error.message.includes("propia cuenta")
          ? "No puedes eliminar tu propia cuenta."
          : SAVE_ERROR_MESSAGE;
      return { ok: false, message };
    }
    revalidatePath("/admin");
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario eliminado con éxito." };
  }

  const success = deleteStoredUser(userId);

  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");
  return { ok: success, message: success ? "Usuario eliminado con éxito." : "No se encontró el usuario." };
}

/**
 * Registrar un nuevo gasto operativo en contabilidad (exclusivo Admin)
 */
export async function createExpenseAction(
  formData: FormData
): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) {
    return {
      ok: false,
      message: "No tienes permisos para registrar gastos operativos.",
    };
  }

  const date = (formData.get("date") as string)?.trim() || "";
  const time = (formData.get("time") as string)?.trim() || "12:00";
  const category = (formData.get("category") as ExpenseCategory) || "otros";
  const concept = (formData.get("concept") as string)?.trim() || "";
  const amount = Number(formData.get("amount"));
  const paymentMethod =
    (formData.get("payment_method") as PaymentMethod) || "transferencia";
  const reference = (formData.get("reference") as string)?.trim() || null;

  if (!date || !concept || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      message: "Por favor ingresa fecha, concepto y un importe mayor a cero.",
    };
  }

  if (isApiConfigured()) {
    const res = await apiRequest("/expenses", {
      method: "POST",
      body: {
        date,
        time,
        category: upper(category),
        concept,
        amount: Math.round(amount),
        paymentMethod: upper(paymentMethod),
        reference,
      },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        date,
        time,
        category,
        concept,
        amount: Math.round(amount),
        payment_method: paymentMethod,
        status: "registrado",
        reference,
      })
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error insertando gasto en Supabase", error?.message);
    }
  } else {
    addStoredExpense({
      date,
      time,
      category,
      concept,
      amount: Math.round(amount),
      payment_method: paymentMethod,
      status: "registrado",
      reference,
      notes: null,
    });
  }

  revalidatePath("/admin/contabilidad/ganancias");
  return { ok: true, message: "Gasto operativo registrado correctamente." };
}

/* ---------------------------------------------------------------------
   AJUSTES CONTABLES (spec F5, tareas 3.23–3.26) · solo admin
   --------------------------------------------------------------------- */

const ACCOUNTING_PATH = "/admin/contabilidad/ganancias";

/**
 * Anular un gasto: deja de sumar pero se conserva con su motivo (tarea 3.23).
 */
export async function voidExpenseAction(expenseId: string, reason: string): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };
  const cleanReason = (reason ?? "").trim();
  if (!cleanReason) return { ok: false, message: "Escribe el motivo de la anulación." };

  if (isApiConfigured()) {
    const res = await apiRequest(`/expenses/${encodeURIComponent(expenseId)}/void`, {
      method: "POST",
      body: { reason: cleanReason },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expenses")
      .update({ status: "anulado", void_reason: cleanReason, voided_at: new Date().toISOString() })
      .eq("id", expenseId)
      .eq("status", "registrado")
      .select("id");
    if (error) return supabaseFailure("Error anulando gasto en Supabase", error.message);
    if (!data?.length) return { ok: false, message: "Este gasto ya está anulado." };
  } else {
    const exp = findStoredExpense(expenseId);
    if (!exp) return { ok: false, message: "No se encontró el gasto." };
    if (exp.status === "anulado") return { ok: false, message: "Este gasto ya está anulado." };
    voidStoredExpense(expenseId, cleanReason);
  }

  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Gasto anulado. Ya no suma en los totales." };
}

/**
 * Editar un gasto registrado (tarea 3.24). Un gasto anulado no se edita.
 */
export async function updateExpenseAction(
  expenseId: string,
  input: {
    date: string;
    time?: string;
    category: ExpenseCategory;
    concept: string;
    amount: number;
    payment_method: PaymentMethod;
    reference?: string | null;
  }
): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };

  const date = (input.date ?? "").trim();
  const concept = (input.concept ?? "").trim();
  const amount = Number(input.amount);
  if (!date || !concept || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Por favor ingresa fecha, concepto y un importe mayor a cero." };
  }
  const changes = {
    date,
    time: (input.time ?? "").trim() || "12:00",
    category: input.category,
    concept,
    amount: Math.round(amount),
    payment_method: input.payment_method,
    reference: (input.reference ?? "").trim() || null,
  };

  if (isApiConfigured()) {
    // PUT reemplaza el gasto completo: se envían todos los campos (contrato §6)
    const res = await apiRequest(`/expenses/${encodeURIComponent(expenseId)}`, {
      method: "PUT",
      body: {
        date: changes.date,
        time: changes.time,
        category: upper(changes.category),
        concept: changes.concept,
        amount: changes.amount,
        paymentMethod: upper(changes.payment_method),
        reference: changes.reference,
      },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expenses")
      .update(changes)
      .eq("id", expenseId)
      .eq("status", "registrado")
      .select("id");
    if (error) return supabaseFailure("Error editando gasto en Supabase", error.message);
    if (!data?.length) return { ok: false, message: "Un gasto anulado no se puede editar." };
  } else {
    const exp = findStoredExpense(expenseId);
    if (!exp) return { ok: false, message: "No se encontró el gasto." };
    if (exp.status === "anulado") return { ok: false, message: "Un gasto anulado no se puede editar." };
    updateStoredExpense(expenseId, changes);
  }

  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Gasto actualizado correctamente." };
}

/**
 * Eliminar un gasto definitivamente, sin rastro (tarea 3.25).
 */
export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };

  if (isApiConfigured()) {
    const res = await apiRequest(`/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE" });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("expenses").delete().eq("id", expenseId).select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error eliminando gasto en Supabase", error?.message);
    }
  } else if (!deleteStoredExpense(expenseId)) {
    return { ok: false, message: "No se encontró el gasto." };
  }

  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Gasto eliminado definitivamente." };
}

/**
 * Ajustar el pago de una cita completada: método, descuento y reembolso (tarea 3.26).
 */
export async function adjustAppointmentPaymentAction(
  appointmentId: string,
  input: {
    payment_method: PaymentMethod;
    discount_amount: number;
    refund_amount: number;
    /** Propina (tarea 3.29): solo se guarda con la API Spring Boot. */
    tip_amount?: number;
  }
): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };

  const discount = Math.round(Number(input.discount_amount) || 0);
  const refund = Math.round(Number(input.refund_amount) || 0);
  if (discount < 0 || refund < 0) {
    return { ok: false, message: "El descuento y el reembolso no pueden ser negativos." };
  }
  const paymentStatus = refund > 0 ? "reembolsado" : "pagado";
  const tooMuch = "El descuento y el reembolso no pueden superar el valor del servicio.";
  const notCompleted = "Solo se puede ajustar el pago de una cita completada.";

  if (isApiConfigured()) {
    const res = await apiRequest(`/appointments/${encodeURIComponent(appointmentId)}/payment`, {
      method: "PATCH",
      body: {
        paymentMethod: upper(input.payment_method),
        discountAmount: discount,
        refundAmount: refund,
        tipAmount: toPesos(input.tip_amount),
      },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: app, error: readError } = await supabase
      .from("appointments")
      .select("status, gross_amount, service:services(price)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (readError || !app) return supabaseFailure("Error leyendo la cita en Supabase", readError?.message);
    if (app.status !== "completada") return { ok: false, message: notCompleted };
    const service = app.service as unknown as { price: number | string } | null;
    const price = Number(app.gross_amount ?? service?.price ?? 0);
    if (discount + refund > price) return { ok: false, message: tooMuch };

    const { data, error } = await supabase
      .from("appointments")
      .update({
        payment_method: input.payment_method,
        discount_amount: discount,
        refund_amount: refund,
        payment_status: paymentStatus,
      })
      .eq("id", appointmentId)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error ajustando el pago en Supabase", error?.message);
    }
  } else {
    const app = getAllStoredAppointments().find((a) => a.id === appointmentId);
    if (!app) return { ok: false, message: "No se encontró la cita." };
    if (app.status !== "completada") return { ok: false, message: notCompleted };
    const price = Number(
      app.gross_amount ?? getStoredServices().find((s) => s.id === app.service_id)?.price ?? 0
    );
    if (discount + refund > price) return { ok: false, message: tooMuch };
    updateStoredAppointmentPayment(appointmentId, {
      payment_status: paymentStatus,
      payment_method: input.payment_method,
      discount_amount: discount,
      refund_amount: refund,
    });
  }

  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Pago de la cita ajustado correctamente." };
}

/**
 * Definir la reserva fija de un servicio para gastos del negocio (tarea 3.27).
 * Solo afecta citas que se completen desde ahora; el historial conserva su reserva.
 */
export async function updateServiceReserveAction(
  serviceId: string,
  amount: number
): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, message: "La reserva debe ser un monto igual o mayor a cero." };
  }

  if (isApiConfigured()) {
    const res = await apiRequest(`/services/${encodeURIComponent(serviceId)}/reserve`, {
      method: "PATCH",
      body: { reserveAmount: value },
    });
    if (!res.ok) return { ok: false, message: res.message };
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: srv, error: readError } = await supabase
      .from("services")
      .select("price")
      .eq("id", serviceId)
      .maybeSingle();
    if (readError || !srv) return supabaseFailure("Error leyendo servicio en Supabase", readError?.message);
    if (value > Number(srv.price)) {
      return { ok: false, message: "La reserva no puede superar el precio del servicio." };
    }
    const { data, error } = await supabase
      .from("services")
      .update({ reserve_amount: value })
      .eq("id", serviceId)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error guardando la reserva en Supabase", error?.message);
    }
  } else {
    const srv = getStoredServices().find((s) => s.id === serviceId);
    if (!srv) return { ok: false, message: "No se encontró el servicio." };
    if (value > srv.price) {
      return { ok: false, message: "La reserva no puede superar el precio del servicio." };
    }
    updateStoredServiceReserve(serviceId, value);
  }

  revalidatePath("/admin/servicios");
  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Reserva actualizada." };
}

/* ---------------------------------------------------------------------
   VENTAS DE PRODUCTOS (tarea 3.30) · solo admin · solo con la API Spring Boot
   --------------------------------------------------------------------- */

/** Registrar una venta de producto: suma a Ingresos y a Tu ganancia, no aparta reserva. */
export async function createProductSaleAction(formData: FormData): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };
  if (!isApiConfigured()) return { ok: false, message: API_ONLY_MESSAGE };

  const res = await apiRequest("/product-sales", {
    method: "POST",
    body: {
      date: ((formData.get("date") as string) ?? "").trim() || null,
      time: ((formData.get("time") as string) ?? "").trim() || null,
      concept: ((formData.get("concept") as string) ?? "").trim(),
      amount: toPesos(formData.get("amount")),
      paymentMethod: upper((formData.get("payment_method") as string) || "efectivo"),
    },
  });
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Venta registrada. Ya suma en Ingresos." };
}

/** Anular una venta con motivo: se conserva visible pero deja de sumar. */
export async function voidProductSaleAction(saleId: string, reason: string): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };
  if (!isApiConfigured()) return { ok: false, message: API_ONLY_MESSAGE };

  const res = await apiRequest(`/product-sales/${encodeURIComponent(saleId)}/void`, {
    method: "POST",
    body: { reason: (reason ?? "").trim() },
  });
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Venta anulada. Ya no suma en los totales." };
}

/** Eliminar una venta definitivamente, sin rastro. */
export async function deleteProductSaleAction(saleId: string): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) return { ok: false, message: FORBIDDEN_MESSAGE };
  if (!isApiConfigured()) return { ok: false, message: API_ONLY_MESSAGE };

  const res = await apiRequest(`/product-sales/${encodeURIComponent(saleId)}`, { method: "DELETE" });
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath(ACCOUNTING_PATH);
  return { ok: true, message: "Venta eliminada definitivamente." };
}
