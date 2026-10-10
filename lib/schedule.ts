/* =====================================================================
   CÁLCULO DE HORARIOS (lib/schedule.ts)
   ---------------------------------------------------------------------
   Funciones puras (sin base de datos) que generan la lista de turnos
   disponibles a partir del horario de atención. Se pueden usar tanto en
   el servidor como en el navegador.
   ===================================================================== */

import type { BusinessHours } from "./types";
import { minutesToTime, timeToMinutes } from "./format";

/**
 * Genera todos los turnos del día según el horario.
 * Ejemplo con apertura 09:00, cierre 12:00 y turnos de 30 min:
 *   ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]
 * Los turnos que caen dentro de la pausa de almuerzo se omiten.
 */
export function generateDailySlots(hours: BusinessHours): string[] {
  const start = timeToMinutes(hours.open_time);
  const end = timeToMinutes(hours.close_time);
  const breakStart = hours.break_start ? timeToMinutes(hours.break_start) : null;
  const breakEnd = hours.break_end ? timeToMinutes(hours.break_end) : null;
  const step = Math.max(hours.slot_minutes, 5);

  const slots: string[] = [];
  for (let t = start; t < end; t += step) {
    const inBreak = breakStart !== null && breakEnd !== null && t >= breakStart && t < breakEnd;
    if (!inBreak) slots.push(minutesToTime(t));
  }
  return slots;
}

/** ¿La barbería abre ese día? (según el día de la semana) */
export function isOpenOn(date: Date, hours: BusinessHours): boolean {
  return hours.open_days.includes(date.getDay());
}
