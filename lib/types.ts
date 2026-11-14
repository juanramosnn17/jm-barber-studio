/* =====================================================================
   TIPOS DE DATOS (lib/types.ts)
   ---------------------------------------------------------------------
   Describen la "forma" de la información que guardamos en Supabase.
   Cada tipo corresponde a una tabla del archivo supabase/schema.sql.
   TypeScript usa estos tipos para avisarnos si escribimos mal un campo.
   ===================================================================== */

/** Roles posibles de un usuario dentro de la aplicación. */
export type UserRole = "cliente" | "barbero" | "admin";

/** Estados por los que pasa una cita. */
export type AppointmentStatus =
  | "pendiente" // El cliente reservó, falta que el estudio la apruebe
  | "confirmada" // Aprobada por el estudio
  | "en_curso" // El barbero ya inició el servicio
  | "completada" // Servicio terminado
  | "cancelada"; // Cancelada por el cliente o rechazada por el estudio

/** Estado financiero del pago asociado a una cita. */
export type PaymentStatus =
  | "pendiente"
  | "pagado"
  | "reembolsado"
  | "anulado";

/** Métodos de pago admitidos en la barbería. */
export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "tarjeta"
  | "nequi_daviplata";

/** Categorías de gastos operativos de la barbería. */
export type ExpenseCategory =
  | "arriendo"
  | "servicios_publicos"
  | "nomina_administrativa"
  | "insumos_generales"
  | "publicidad"
  | "mantenimiento"
  | "otros";

/** Estado de un registro de gasto operativo. */
export type ExpenseStatus = "registrado" | "anulado";

/**
 * DATOS DE SUPABASE: tabla "profiles".
 * Un perfil por cada usuario registrado (se crea automáticamente al
 * registrarse gracias a un "trigger" definido en schema.sql).
 */
export interface Profile {
  id: string; // Mismo id que el usuario de Supabase Auth
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  reminders_opt_in: boolean; // ¿Acepta recordatorios por WhatsApp/SMS?
  created_at?: string;
}

/**
 * DATOS DE SUPABASE: tabla "services".
 * Catálogo de servicios que ofrece la barbería.
 */
export interface Service {
  id: string;
  name: string; // Nombre largo (p. ej. "Corte Pro (Cabello + Barba)")
  short_name: string; // Nombre corto para los botones (p. ej. "Corte Pro")
  description: string;
  includes: string | null; // Qué incluye (texto libre)
  price: number; // Precio en la moneda configurada (sin decimales para COP)
  direct_cost?: number; // Costo directo de insumos por servicio (COP)
  commission_percentage?: number; // % de comisión para el barbero sobre el servicio (0-100)
  duration_label: string; // Texto de duración (p. ej. "35-40 min")
  duration_minutes: number; // Duración máxima en minutos (para calcular agenda)
  image_url: string | null; // Ruta de la imagen (p. ej. "/images/servicios/corte.jpg")
  icon: string; // Nombre del icono de Material Symbols
  is_active: boolean; // Si es false, el cliente no lo ve al reservar
  sort_order: number; // Orden de aparición
}

/**
 * DATOS DE SUPABASE: tabla "appointments".
 * Cada fila es una cita reservada por un cliente.
 */
export interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  barber_name: string | null;
  chair: string | null; // Sillón asignado (p. ej. "Sillón 01")
  date: string; // Fecha "YYYY-MM-DD"
  time: string; // Hora "HH:MM" (24 h)
  status: AppointmentStatus;
  notes: string | null;
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod | null;
  gross_amount?: number | null;
  discount_amount?: number;
  refund_amount?: number;
  tip_amount?: number;
  direct_cost_amount?: number | null;
  commission_amount?: number | null;
  paid_at?: string | null;
  created_at?: string;
}

/** Cita "enriquecida" con el nombre del cliente y del servicio (para listas). */
export interface AppointmentWithDetails extends Appointment {
  client_name: string;
  service_name: string;
  duration_label?: string;
}

/**
 * DATOS DE SUPABASE: tabla "expenses".
 * Gastos operativos registrados en la barbería.
 */
export interface Expense {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  category: ExpenseCategory;
  concept: string;
  amount: number;
  payment_method: PaymentMethod;
  status: ExpenseStatus;
  reference: string | null;
  notes: string | null;
  created_at?: string;
}

/**
 * DATOS DE SUPABASE: tabla "business_hours".
 * Configuración del horario de atención (una sola fila, id = 1).
 */
export interface BusinessHours {
  id: number;
  open_days: number[]; // 0 = domingo ... 6 = sábado
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
  break_start: string | null;
  break_end: string | null;
  slot_minutes: number;
  barbers_count: number;
}

/** Resultado estándar que devuelven las "Server Actions" a los formularios. */
export interface ActionResult {
  ok: boolean;
  message?: string;
}
