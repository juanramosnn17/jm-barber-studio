/* =====================================================================
   ALMACÉN DE DATOS EN MEMORIA / PERSISTENCIA (lib/data/store.ts)
   ---------------------------------------------------------------------
   Este módulo mantiene en memoria los datos del sistema para que toda
   la aplicación sea 100% interactiva y funcional de inmediato, tanto
   en desarrollo local como en modo demostración o cuando Supabase no
   tenga conexión activa.

   Permite:
   - Registrar nuevos usuarios y permitirles iniciar sesión.
   - Administrar la sesión actual del usuario activo (cliente o admin).
   - Crear, reservar y listar citas con confirmación.
   - Modificar días y horas de atención desde el panel admin y ver el
     cambio de inmediato en la pantalla del cliente.
   - Agregar, editar o desactivar servicios (incluyendo imagen y textos)
     desde el admin y verlos reflejados al instante en el cliente y home.
   ===================================================================== */

import type {
  AppointmentWithDetails,
  BusinessHours,
  Expense,
  PaymentMethod,
  PaymentStatus,
  Profile,
  Service,
  UserRole,
} from "@/lib/types";
import {
  mockAdmin,
  mockBusinessHours,
  mockClient,
  mockProfiles,
  mockServices,
  getMockTodayAppointments,
  getMockHistoricalAppointments,
  getMockExpenses,
  getMockNextAppointment,
} from "./mock";

interface StoredUser extends Profile {
  password?: string;
}

// Estructura global en memoria (se mantiene entre recargas en el mismo proceso de servidor)
declare global {
  var __jm_store: {
    users: StoredUser[];
    services: Service[];
    businessHours: BusinessHours;
    appointments: AppointmentWithDetails[];
    expenses: Expense[];
  } | undefined;
}

if (!globalThis.__jm_store) {
  globalThis.__jm_store = {
    users: [
      { ...mockAdmin, password: "123" },
      { ...mockClient, password: "123" },
      ...mockProfiles
        .filter((p) => p.id !== mockAdmin.id && p.id !== mockClient.id)
        .map((p) => ({ ...p, password: "123" })),
    ],
    services: [...mockServices],
    businessHours: { ...mockBusinessHours },
    appointments: [
      getMockNextAppointment(),
      ...getMockTodayAppointments(),
      ...getMockHistoricalAppointments(),
    ],
    expenses: [...getMockExpenses()],
  };
} else if (!globalThis.__jm_store.expenses) {
  globalThis.__jm_store.expenses = [...getMockExpenses()];
}

const store = globalThis.__jm_store;

/* ---------------------------------------------------------------------
   USUARIOS Y AUTENTICACIÓN
   --------------------------------------------------------------------- */

export function findUserByCredentials(identifier: string, password?: string): StoredUser | null {
  const cleanId = identifier.trim().toLowerCase();
  const user = store.users.find(
    (u) =>
      u.email.toLowerCase() === cleanId ||
      (u.phone && u.phone.replace(/\s+/g, "").includes(cleanId.replace(/\s+/g, "")))
  );

  if (!user) return null;
  // Si se proporciona contraseña, se valida (por defecto en demo las precargadas usan "123" o coinciden)
  if (password && user.password && user.password !== password) {
    return null;
  }
  return user;
}

export function findUserById(id: string): StoredUser | null {
  return store.users.find((u) => u.id === id) || null;
}

export function registerNewUser(data: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  password?: string;
  role?: UserRole;
  reminders_opt_in?: boolean;
}): StoredUser {
  const cleanEmail = data.email.trim().toLowerCase();
  const existing = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    throw new Error("El correo electrónico ya está registrado.");
  }

  const newUser: StoredUser = {
    id: `usr-${Date.now()}`,
    first_name: data.first_name.trim(),
    last_name: data.last_name?.trim() || "",
    email: cleanEmail,
    phone: data.phone || null,
    role: data.role || "cliente",
    avatar_url: "/images/avatares/cliente.jpg",
    reminders_opt_in: data.reminders_opt_in ?? true,
    password: data.password || "123",
    created_at: new Date().toISOString(),
  };

  store.users.push(newUser);
  return newUser;
}

export function getAllUsers(): Profile[] {
  // Nunca devolver la contraseña del modo demo
  return store.users.map((u) => {
    const profile: Partial<StoredUser> = { ...u };
    delete profile.password;
    return profile as Profile;
  });
}

export function updateStoredUser(
  userId: string,
  data: Partial<Pick<Profile, "first_name" | "last_name" | "email" | "phone" | "role">>
): Profile | null {
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;

  if (data.first_name !== undefined) user.first_name = data.first_name.trim();
  if (data.last_name !== undefined) user.last_name = data.last_name.trim();
  if (data.email !== undefined) user.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) user.phone = data.phone?.trim() || null;
  if (data.role !== undefined) user.role = data.role;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...profile } = user;
  return profile;
}

export function deleteStoredUser(userId: string): boolean {
  const index = store.users.findIndex((u) => u.id === userId);
  if (index === -1) return false;
  store.users.splice(index, 1);
  return true;
}

/* ---------------------------------------------------------------------
   SERVICIOS
   --------------------------------------------------------------------- */

export function getStoredServices(onlyActive = false): Service[] {
  const list = [...store.services].sort((a, b) => a.sort_order - b.sort_order);
  return onlyActive ? list.filter((s) => s.is_active) : list;
}

/** Define la reserva fija de un servicio (modo demo, tarea 3.27). */
export function updateStoredServiceReserve(serviceId: string, amount: number): Service | null {
  const srv = store.services.find((s) => s.id === serviceId);
  if (!srv) return null;
  srv.reserve_amount = amount;
  return srv;
}

export function toggleStoredServiceActive(serviceId: string): Service | null {
  const srv = store.services.find((s) => s.id === serviceId);
  if (!srv) return null;
  srv.is_active = !srv.is_active;
  return srv;
}

export function addStoredService(newSrv: Omit<Service, "id" | "sort_order">): Service {
  const service: Service = {
    ...newSrv,
    direct_cost: newSrv.direct_cost ?? Math.round(newSrv.price * 0.1),
    commission_percentage: newSrv.commission_percentage ?? 40,
    id: `srv-${Date.now()}`,
    sort_order: store.services.length + 1,
  };
  store.services.push(service);
  return service;
}

/* ---------------------------------------------------------------------
   HORARIOS DE ATENCIÓN
   --------------------------------------------------------------------- */

export function getStoredBusinessHours(): BusinessHours {
  return { ...store.businessHours };
}

export function updateStoredBusinessHours(updated: Partial<BusinessHours>): BusinessHours {
  store.businessHours = {
    ...store.businessHours,
    ...updated,
  };
  return { ...store.businessHours };
}

/* ---------------------------------------------------------------------
   CITAS Y RESERVAS
   --------------------------------------------------------------------- */

export function getStoredAppointments(date?: string): AppointmentWithDetails[] {
  if (date) {
    return store.appointments.filter((a) => a.date === date && a.status !== "cancelada");
  }
  return [...store.appointments];
}

export function getAllStoredAppointments(): AppointmentWithDetails[] {
  return [...store.appointments];
}

export function getClientNextAppointment(clientId: string): AppointmentWithDetails | null {
  const today = new Date().toISOString().slice(0, 10);
  const found = store.appointments
    .filter(
      (a) =>
        a.client_id === clientId &&
        a.date >= today &&
        (a.status === "confirmada" || a.status === "pendiente")
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return found[0] || null;
}

export function addStoredAppointment(data: {
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
  duration_label?: string;
  barber_name?: string | null;
  chair?: string | null;
  date: string;
  time: string;
  notes?: string | null;
}): AppointmentWithDetails {
  const srv = store.services.find((s) => s.id === data.service_id);
  const price = srv?.price ?? 0;
  const directCost = srv?.direct_cost ?? Math.round(price * 0.1);
  const commissionPct = srv?.commission_percentage ?? 40;
  const commissionAmt = Math.round((price * commissionPct) / 100);

  const newApp: AppointmentWithDetails = {
    id: `app-${Date.now()}`,
    client_id: data.client_id,
    client_name: data.client_name,
    service_id: data.service_id,
    service_name: data.service_name,
    duration_label: data.duration_label || "40 min",
    barber_name: data.barber_name ?? "Pendiente de asignación",
    chair: data.chair ?? "No asignado",
    date: data.date,
    time: data.time,
    status: "confirmada",
    notes: data.notes || null,
    payment_status: "pendiente",
    payment_method: null,
    gross_amount: price,
    discount_amount: 0,
    refund_amount: 0,
    tip_amount: 0,
    direct_cost_amount: directCost,
    commission_amount: commissionAmt,
    paid_at: null,
    created_at: new Date().toISOString(),
  };

  store.appointments.unshift(newApp);
  return newApp;
}

export function updateStoredAppointmentStatus(
  appointmentId: string,
  newStatus: AppointmentWithDetails["status"],
  paymentMethod?: PaymentMethod
): boolean {
  const app = store.appointments.find((a) => a.id === appointmentId);
  if (!app) return false;
  app.status = newStatus;

  const srv = store.services.find((s) => s.id === app.service_id);
  const defaultGross = app.gross_amount ?? srv?.price ?? 0;

  if (newStatus === "completada" && (!app.payment_status || app.payment_status === "pendiente")) {
    app.payment_status = "pagado";
    app.payment_method = paymentMethod ?? app.payment_method ?? "efectivo";
    app.gross_amount = defaultGross;
    // Modelo de reserva (tarea 3.27): sin comisión; se fija la reserva del servicio
    app.reserve_amount = srv?.reserve_amount ?? 0;
    app.commission_amount = 0;
    app.paid_at = new Date().toISOString();
  } else if (newStatus === "cancelada" && app.payment_status === "pendiente") {
    app.payment_status = "anulado";
  }

  return true;
}

export function updateStoredAppointmentPayment(
  appointmentId: string,
  payment: {
    payment_status: PaymentStatus;
    payment_method?: PaymentMethod | null;
    gross_amount?: number;
    discount_amount?: number;
    refund_amount?: number;
    tip_amount?: number;
  }
): AppointmentWithDetails | null {
  const app = store.appointments.find((a) => a.id === appointmentId);
  if (!app) return null;

  app.payment_status = payment.payment_status;
  if (payment.payment_method !== undefined) app.payment_method = payment.payment_method;
  if (payment.gross_amount !== undefined) app.gross_amount = payment.gross_amount;
  if (payment.discount_amount !== undefined) app.discount_amount = payment.discount_amount;
  if (payment.refund_amount !== undefined) app.refund_amount = payment.refund_amount;
  if (payment.tip_amount !== undefined) app.tip_amount = payment.tip_amount;
  if (payment.payment_status === "pagado" && !app.paid_at) {
    app.paid_at = new Date().toISOString();
  }

  return app;
}

/* ---------------------------------------------------------------------
   GASTOS OPERATIVOS (EXPENSES)
   --------------------------------------------------------------------- */

export function getStoredExpenses(): Expense[] {
  return [...(store.expenses ?? [])].sort((a, b) =>
    `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
  );
}

export function addStoredExpense(
  data: Omit<Expense, "id" | "created_at">
): Expense {
  const expense: Expense = {
    ...data,
    id: `exp-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  if (!store.expenses) store.expenses = [];
  store.expenses.unshift(expense);
  return expense;
}

/** Busca un gasto por id (modo demo). */
export function findStoredExpense(expenseId: string): Expense | null {
  return (store.expenses ?? []).find((e) => e.id === expenseId) ?? null;
}

/** Corrige un gasto registrado (modo demo, tarea 3.24). */
export function updateStoredExpense(
  expenseId: string,
  data: Partial<Omit<Expense, "id" | "created_at" | "status">>
): Expense | null {
  const exp = findStoredExpense(expenseId);
  if (!exp) return null;
  Object.assign(exp, data);
  return exp;
}

/** Anula un gasto conservando su rastro (modo demo, tarea 3.23). */
export function voidStoredExpense(expenseId: string, reason: string): Expense | null {
  const exp = findStoredExpense(expenseId);
  if (!exp) return null;
  exp.status = "anulado";
  exp.void_reason = reason;
  exp.voided_at = new Date().toISOString();
  return exp;
}

/** Elimina un gasto definitivamente (modo demo, tarea 3.25). */
export function deleteStoredExpense(expenseId: string): boolean {
  const before = store.expenses?.length ?? 0;
  store.expenses = (store.expenses ?? []).filter((e) => e.id !== expenseId);
  return store.expenses.length < before;
}
