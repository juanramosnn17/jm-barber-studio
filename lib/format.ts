/* =====================================================================
   FUNCIONES DE FORMATO (lib/format.ts)
   ---------------------------------------------------------------------
   Pequeñas utilidades para mostrar precios, fechas y horas de forma
   bonita y en español. Se usan en muchas pantallas.
   ===================================================================== */

import { siteConfig } from "./config";

/** Convierte un número en precio con moneda. Ej.: 25000 → "$ 25.000" */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: siteConfig.currency,
    // Los pesos colombianos no usan centavos en la práctica
    maximumFractionDigits: siteConfig.currency === "COP" ? 0 : 2,
  }).format(value);
}

/**
 * Convierte "YYYY-MM-DD" en un objeto Date a medianoche LOCAL.
 * (new Date("2025-10-16") usaría UTC y podría mostrar el día anterior).
 */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Convierte un Date en texto "YYYY-MM-DD" (formato que guarda Supabase). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2025-10-16" → "Viernes, 16 de octubre" */
export function formatLongDate(iso: string): string {
  const text = parseISODate(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return capitalize(text);
}

/** "2025-10-16" → "16 de octubre de 2025" */
export function formatFullDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "16:00" → { time: "04:00", period: "PM" } (para los bloques de hora) */
export function splitTime12h(time24: string): { time: string; period: "AM" | "PM" } {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { time: `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")}`, period };
}

/** "16:00" → "04:00 PM" */
export function formatTime12h(time24: string): string {
  const { time, period } = splitTime12h(time24);
  return `${time} ${period}`;
}

/** "Juan Felipe Ortiz" → "JO" (iniciales para avatares sin foto) */
export function getInitials(firstName: string, lastName = ""): string {
  const a = firstName.trim().charAt(0);
  const b = (lastName.trim() || firstName.trim().split(" ")[1] || "").charAt(0);
  return `${a}${b}`.toUpperCase();
}

/** Pone en mayúscula la primera letra: "viernes" → "Viernes" */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Convierte "HH:MM" a minutos desde medianoche. "09:30" → 570 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a "HH:MM". 570 → "09:30" */
export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
