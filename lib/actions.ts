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

   Modo dual (tareas 3.12 y 3.16):
     - Con Supabase configurado, cada acción escribe SOLO en Supabase y
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
import { getCurrentProfile } from "@/lib/data/queries";
import { isPastSlot } from "@/lib/schedule";
import {
  addStoredAppointment,
  addStoredExpense,
  addStoredService,
  findUserByCredentials,
  getAllStoredAppointments,
  getStoredAppointments,
  registerNewUser,
  toggleStoredServiceActive,
  updateStoredAppointmentAssignment,
  updateStoredAppointmentStatus,
  updateStoredBusinessHours,
  getStoredServices,
  updateStoredUser,
  deleteStoredUser,
  findStoredExpense,
  updateStoredExpense,
  voidStoredExpense,
  deleteStoredExpense,
  updateStoredAppointmentPayment,
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
  const returnUrl = formData.get("return_url") as string | null;
  const safeReturnUrl = returnUrl && returnUrl.startsWith("/") ? returnUrl : null;

  if (!emailOrPhone || !password) {
    return { ok: false, message: "Por favor ingresa correo o teléfono y tu contraseña." };
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

  if (returnUrl && (returnUrl.startsWith("/") || returnUrl.startsWith("#"))) {
    redirect(returnUrl);
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
  const reminders = formData.get("reminders") === "on";

  if (!firstName || !email || !password) {
    return { ok: false, message: "Por favor completa todos los campos obligatorios." };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "Las contraseñas no coinciden." };
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
          reminders_opt_in: reminders,
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
      reminders_opt_in: reminders,
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
    // En Supabase, RLS ya limita al cliente a sus propias citas; en demo se verifica aquí.
    if (!isSupabaseConfigured()) {
      const own = getAllStoredAppointments().some(
        (a) => a.id === appointmentId && a.client_id === user.id
      );
      if (!own) return { ok: false, message: FORBIDDEN_MESSAGE };
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === "completada") {
      updatePayload.payment_status = "pagado";
      updatePayload.payment_method = "efectivo";
      updatePayload.paid_at = new Date().toISOString();
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
 * Asignar barbero y sillón a una cita desde el panel de Administración
 */
export async function assignAppointmentBarberAction(
  appointmentId: string,
  barberName: string,
  chair: string
): Promise<ActionResult> {
  if (!(await requireRole(["admin", "barbero"]))) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }

  const cleanBarber = barberName.trim() || "Pendiente de asignación";
  const cleanChair = chair.trim() || "No asignado";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ barber_name: cleanBarber, chair: cleanChair })
      .eq("id", appointmentId)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error asignando barbero en Supabase", error?.message);
    }
  } else {
    updateStoredAppointmentAssignment(appointmentId, cleanBarber, cleanChair);
  }

  revalidatePath("/admin");
  revalidatePath("/cliente");
  return { ok: true, message: "Barbero y sillón asignados correctamente." };
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

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_hours")
      .update(hoursData)
      .eq("id", 1)
      .select("id");
    if (error || !data?.length) {
      return supabaseFailure("Error guardando horario en Supabase", error?.message);
    }
  } else {
    updateStoredBusinessHours(hoursData);
  }

  revalidatePath("/cliente");
  revalidatePath("/admin");
  return { ok: true, message: "Horarios actualizados correctamente." };
}

/**
 * Alternar visibilidad de un servicio (Activar / Desactivar)
 */
export async function toggleServiceActiveAction(serviceId: string): Promise<ActionResult> {
  if (!(await requireRole(["admin"]))) {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }

  if (isSupabaseConfigured()) {
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

  const name = formData.get("name") as string;
  const shortName = formData.get("short_name") as string;
  const description = formData.get("description") as string;
  const includes = formData.get("includes") as string;
  const price = parseFloat(formData.get("price") as string) || 0;
  const durationLabel = formData.get("duration_label") as string || "30 min";
  const durationMinutes = parseInt(formData.get("duration_minutes") as string, 10) || 30;
  const icon = (formData.get("icon") as string) || "content_cut";
  let imageUrl = (formData.get("image_url") as string) || "/images/servicios/corte-cabello.jpg";

  // Si se subió un archivo o se ingresó una URL personalizada
  const customImg = formData.get("custom_image_url") as string;
  if (customImg && customImg.trim().length > 0) {
    imageUrl = customImg.trim();
  }

  if (!name || !price) {
    return { ok: false, message: "Nombre y precio son obligatorios." };
  }

  const newServiceData: Omit<Service, "id" | "sort_order"> = {
    name,
    short_name: shortName || name,
    description: description || "Servicio profesional de cuidado masculino.",
    includes: includes || null,
    price,
    duration_label: durationLabel,
    duration_minutes: durationMinutes,
    image_url: imageUrl,
    icon,
    is_active: true,
  };

  if (isSupabaseConfigured()) {
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
  return { ok: true, message: "Servicio creado exitosamente." };
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

  if (isSupabaseConfigured()) {
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

  if (isSupabaseConfigured()) {
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

  if (isSupabaseConfigured()) {
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

  if (isSupabaseConfigured()) {
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

  if (isSupabaseConfigured()) {
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
  input: { payment_method: PaymentMethod; discount_amount: number; refund_amount: number }
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

  if (isSupabaseConfigured()) {
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
