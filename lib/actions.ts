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
   ===================================================================== */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { clearSessionUser, getSessionUserProfile, setSessionUser } from "@/lib/auth/session";
import {
  addStoredAppointment,
  addStoredService,
  findUserByCredentials,
  registerNewUser,
  toggleStoredServiceActive,
  updateStoredAppointmentStatus,
  updateStoredBusinessHours,
  getStoredServices,
  updateStoredUser,
  deleteStoredUser,
} from "@/lib/data/store";
import type { ActionResult, AppointmentStatus, BusinessHours, Service } from "./types";

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

  if (!emailOrPhone || !password) {
    return { ok: false, message: "Por favor ingresa correo o teléfono y tu contraseña." };
  }

  // 1. Si Supabase está configurado, intentar autenticación con Supabase Auth
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailOrPhone,
        password,
      });

      if (!error && data.user) {
        // Consultar rol en la tabla profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        await setSessionUser(data.user.id);

        if (returnUrl) {
          redirect(returnUrl);
        }

        if (profile?.role === "admin" || profile?.role === "barbero") {
          redirect("/admin");
        } else {
          redirect("/cliente");
        }
      }
    } catch (err: unknown) {
      // Si Next.js lanzó una redirección, dejarla pasar
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
        throw err;
      }
      console.warn("Fallo login en Supabase, intentando verificación local...");
    }
  }

  // 2. Verificación contra el Store en memoria
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

  // 1. Si Supabase está disponible, registrar en Auth y profiles
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName || "",
            phone: phone ? `+57 ${phone.trim()}` : null,
            role: "cliente",
            reminders_opt_in: reminders,
          },
        },
      });

      if (error) {
        return { ok: false, message: error.message };
      }

      if (authData.user) {
        await setSessionUser(authData.user.id);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
      console.warn("Error en registro Supabase, procediendo a guardar localmente:", err);
    }
  }

  // 2. Registrar en store local
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
      await supabase.auth.signOut();
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

  // Obtener perfil actual
  const user = await getSessionUserProfile();
  const clientId = user?.id || "usr-anonimo";
  const clientName = user ? `${user.first_name} ${user.last_name}`.trim() : "Cliente";

  // Buscar servicio para guardar nombres amigables
  const allServices = getStoredServices();
  const srv = allServices.find((s) => s.id === serviceId);
  const serviceName = srv?.name || "Servicio";
  const durationLabel = srv?.duration_label || "40 min";

  // 1. Guardar en store local para inmediatez
  const newApp = addStoredAppointment({
    client_id: clientId,
    client_name: clientName,
    service_id: serviceId,
    service_name: serviceName,
    duration_label: durationLabel,
    date,
    time,
    notes,
  });

  // 2. Si Supabase está configurado, replicar en la tabla appointments
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.from("appointments").insert({
        client_id: clientId,
        service_id: serviceId,
        date,
        time,
        status: "confirmada",
        notes: notes || null,
      });
    } catch (e) {
      console.warn("No se pudo replicar cita en Supabase:", e);
    }
  }

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
  updateStoredAppointmentStatus(appointmentId, newStatus);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId);
    } catch (e) {
      console.warn("Error actualizando cita en Supabase:", e);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/cliente");
  return { ok: true };
}

/**
 * Guardar horario de atención (Admin -> Cliente de inmediato)
 */
export async function updateBusinessHoursAction(
  hoursData: Partial<BusinessHours>
): Promise<ActionResult> {
  updateStoredBusinessHours(hoursData);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase
        .from("business_hours")
        .update(hoursData)
        .eq("id", 1);
    } catch (e) {
      console.warn("Error guardando horario en Supabase:", e);
    }
  }

  revalidatePath("/cliente");
  revalidatePath("/admin");
  return { ok: true, message: "Horarios actualizados correctamente." };
}

/**
 * Alternar visibilidad de un servicio (Activar / Desactivar)
 */
export async function toggleServiceActiveAction(serviceId: string): Promise<ActionResult> {
  const updated = toggleStoredServiceActive(serviceId);

  if (isSupabaseConfigured() && updated) {
    try {
      const supabase = await createClient();
      await supabase
        .from("services")
        .update({ is_active: updated.is_active })
        .eq("id", serviceId);
    } catch (e) {
      console.warn("Error actualizando servicio en Supabase:", e);
    }
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

  addStoredService(newServiceData);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.from("services").insert(newServiceData);
    } catch (e) {
      console.warn("Error insertando servicio en Supabase:", e);
    }
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
  if (!userId || !data.first_name || !data.email) {
    return { ok: false, message: "Nombre y correo son obligatorios." };
  }

  updateStoredUser(userId, data);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase
        .from("profiles")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || null,
          role: data.role,
        })
        .eq("id", userId);
    } catch (e) {
      console.warn("Error actualizando perfil en Supabase:", e);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Usuario actualizado correctamente." };
}

/**
 * Eliminar un usuario (Admin)
 */
export async function deleteUserAction(userId: string): Promise<ActionResult> {
  if (!userId) {
    return { ok: false, message: "ID de usuario inválido." };
  }

  const success = deleteStoredUser(userId);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.from("profiles").delete().eq("id", userId);
    } catch (e) {
      console.warn("Error eliminando perfil en Supabase:", e);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");
  return { ok: success, message: success ? "Usuario eliminado con éxito." : "No se encontró el usuario." };
}
