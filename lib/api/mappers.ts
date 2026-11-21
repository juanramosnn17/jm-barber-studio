/* =====================================================================
   ADAPTADORES API → TIPOS DEL FRONTEND (lib/api/mappers.ts)
   ---------------------------------------------------------------------
   La API usa camelCase y enums en MAYÚSCULAS (CONFIRMADA, NEQUI_DAVIPLATA);
   los componentes usan los tipos de lib/types.ts (snake_case, minúsculas).
   Convertir aquí evita tocar los componentes (contrato §8).
   ===================================================================== */

import type {
  AppointmentStatus,
  AppointmentWithDetails,
  BusinessHours,
  PaymentMethod,
  PaymentStatus,
  Profile,
  Service,
  UserRole,
} from "@/lib/types";

export type ApiUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
};

export type ApiService = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  includes: string | null;
  price: number;
  durationLabel: string;
  durationMinutes: number;
  imageUrl: string | null;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  reserveAmount: number;
};

export type ApiAppointment = {
  id: string;
  clientId: string | null; // null si el cliente fue eliminado (clientName = "Cliente eliminado")
  clientName: string;
  serviceId: string;
  serviceName: string;
  durationLabel: string;
  date: string;
  time: string;
  endTime: string;
  status: string;
  notes: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
};

export type ApiBusinessHours = {
  openDays: number[];
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  slotMinutes: number;
};

/** "NEQUI_DAVIPLATA" → "nequi_daviplata" */
export function lower<T extends string>(value: string): T {
  return value.toLowerCase() as T;
}

/** "nequi_daviplata" → "NEQUI_DAVIPLATA" */
export function upper(value: string): string {
  return value.toUpperCase();
}

export function toProfile(u: ApiUser): Profile {
  return {
    id: u.id,
    first_name: u.firstName,
    last_name: u.lastName ?? "",
    email: u.email,
    phone: u.phone,
    role: lower<UserRole>(u.role),
    avatar_url: null,
    reminders_opt_in: false,
  };
}

export function toService(s: ApiService): Service {
  return {
    id: s.id,
    name: s.name,
    short_name: s.shortName,
    description: s.description,
    includes: s.includes,
    price: s.price,
    reserve_amount: s.reserveAmount,
    duration_label: s.durationLabel,
    duration_minutes: s.durationMinutes,
    image_url: s.imageUrl,
    icon: s.icon,
    is_active: s.isActive,
    sort_order: s.sortOrder,
  };
}

export function toAppointment(a: ApiAppointment): AppointmentWithDetails {
  return {
    id: a.id,
    client_id: a.clientId ?? "", // "" = cliente eliminado; no coincide con ningún usuario
    service_id: a.serviceId,
    barber_name: null, // un solo barbero: no se asigna (decisión del estudiante)
    chair: null,
    date: a.date,
    time: a.time,
    end_time: a.endTime,
    status: lower<AppointmentStatus>(a.status),
    notes: a.notes,
    payment_status: lower<PaymentStatus>(a.paymentStatus),
    payment_method: a.paymentMethod ? lower<PaymentMethod>(a.paymentMethod) : null,
    client_name: a.clientName,
    service_name: a.serviceName,
    duration_label: a.durationLabel,
  };
}

export function toBusinessHours(h: ApiBusinessHours): BusinessHours {
  return {
    id: 1,
    open_days: h.openDays,
    open_time: h.openTime,
    close_time: h.closeTime,
    break_start: h.breakStart,
    break_end: h.breakEnd,
    slot_minutes: h.slotMinutes,
    barbers_count: 1,
  };
}

export function fromBusinessHours(h: BusinessHours): ApiBusinessHours {
  return {
    openDays: h.open_days,
    openTime: h.open_time.slice(0, 5),
    closeTime: h.close_time.slice(0, 5),
    breakStart: h.break_start ? h.break_start.slice(0, 5) : null,
    breakEnd: h.break_end ? h.break_end.slice(0, 5) : null,
    slotMinutes: h.slot_minutes,
  };
}
