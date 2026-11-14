/* =====================================================================
   CÁLCULO DE HORARIOS (lib/schedule.ts)
   ---------------------------------------------------------------------
   Funciones puras (sin base de datos) que generan la lista de turnos
   disponibles a partir del horario de atención. Se pueden usar tanto en
   el servidor como en el navegador.
   ===================================================================== */

import type { BusinessHours } from "./types";
import { minutesToTime, timeToMinutes } from "./format";
import { siteConfig } from "./config";

/**
 * Fecha (YYYY-MM-DD) y minutos del día "ahora" en la zona horaria del
 * estudio (America/Bogota), sin importar la zona del servidor o del
 * navegador. Tarea 3.18.
 */
export function nowInStudio(now: Date = new Date()): { dateISO: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** ¿El turno (fecha + hora) ya pasó en la hora del estudio? */
export function isPastSlot(dateISO: string, time: string, now: Date = new Date()): boolean {
  const current = nowInStudio(now);
  if (dateISO !== current.dateISO) return dateISO < current.dateISO;
  return timeToMinutes(time.slice(0, 5)) <= current.minutes;
}

/**
 * Genera los turnos disponibles del día según el horario de atención
 * y excluye los bloques horarios que ya tienen citas activas/reservadas.
 * Ejemplo con apertura 09:00, cierre 12:00 y turnos de 30 min:
 *   ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]
 * Los turnos que caen dentro de la pausa de almuerzo o que ya están
 * ocupados se omiten para evitar overbooking (cruce de citas).
 */
export function generateDailySlots(
  hours: BusinessHours,
  bookedSlots: Array<string | { time: string; status?: string }> = [],
  dateISO?: string
): string[] {
  const start = timeToMinutes(hours.open_time);
  const end = timeToMinutes(hours.close_time);
  const breakStart = hours.break_start ? timeToMinutes(hours.break_start) : null;
  const breakEnd = hours.break_end ? timeToMinutes(hours.break_end) : null;
  const step = Math.max(hours.slot_minutes, 5);

  const occupiedTimes = new Set<string>();
  for (const item of bookedSlots) {
    if (typeof item === "string") {
      occupiedTimes.add(item.trim().slice(0, 5));
    } else if (item && typeof item.time === "string" && item.status !== "cancelada") {
      occupiedTimes.add(item.time.trim().slice(0, 5));
    }
  }

  const slots: string[] = [];
  for (let t = start; t < end; t += step) {
    const inBreak = breakStart !== null && breakEnd !== null && t >= breakStart && t < breakEnd;
    if (inBreak) continue;

    const slotTime = minutesToTime(t);
    // Si se indica la fecha, se omiten los turnos que ya pasaron (tarea 3.18)
    if (dateISO && isPastSlot(dateISO, slotTime)) continue;
    if (!occupiedTimes.has(slotTime)) {
      slots.push(slotTime);
    }
  }
  return slots;
}

/** ¿La barbería abre ese día? (según el día de la semana) */
export function isOpenOn(date: Date, hours: BusinessHours): boolean {
  return hours.open_days.includes(date.getDay());
}
