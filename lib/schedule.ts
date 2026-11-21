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

/** Rango ocupado de la agenda, "HH:MM" a "HH:MM" (fin excluido), sin datos de nadie. */
export type BookedRange = { start: string; end: string };

/**
 * Genera las horas de inicio donde el servicio CABE COMPLETO (tarea 4.12, spec F2):
 * el rango [inicio, inicio + duración) empieza en un turno del horario, termina a más
 * tardar al cierre, no cruza el descanso, no se cruza con ninguna cita ocupada y no
 * empieza en el pasado. Son las mismas reglas que valida el servidor.
 * Ejemplo: apertura 09:00, cierre 12:00, turnos de 30 min, servicio de 60 min y una cita
 * ocupada 10:00–10:40 → ["09:00", "11:00"] (09:30, 10:00 y 10:30 se cruzan con la cita).
 */
export function generateDailySlots(
  hours: BusinessHours,
  bookedRanges: BookedRange[] = [],
  dateISO?: string,
  durationMinutes: number = hours.slot_minutes
): string[] {
  const open = timeToMinutes(hours.open_time);
  const close = timeToMinutes(hours.close_time);
  const breakStart = hours.break_start ? timeToMinutes(hours.break_start) : null;
  const breakEnd = hours.break_end ? timeToMinutes(hours.break_end) : null;
  const step = Math.max(hours.slot_minutes, 5);
  const duration = Math.max(durationMinutes, 1);

  const busy = bookedRanges.map((r) => ({
    start: timeToMinutes(r.start.slice(0, 5)),
    end: timeToMinutes(r.end.slice(0, 5)),
  }));

  const slots: string[] = [];
  for (let t = open; t + duration <= close; t += step) {
    const end = t + duration;
    const crossesBreak = breakStart !== null && breakEnd !== null && t < breakEnd && end > breakStart;
    if (crossesBreak) continue;
    if (busy.some((b) => t < b.end && end > b.start)) continue;

    const slotTime = minutesToTime(t);
    // Si se indica la fecha, se omiten los turnos que ya pasaron (tarea 3.18)
    if (dateISO && isPastSlot(dateISO, slotTime)) continue;
    slots.push(slotTime);
  }
  return slots;
}

/** ¿La barbería abre ese día? (según el día de la semana) */
export function isOpenOn(date: Date, hours: BusinessHours): boolean {
  return hours.open_days.includes(date.getDay());
}
