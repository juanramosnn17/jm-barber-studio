/* =====================================================================
   LECTURAS QUE EL NAVEGADOR PUEDE INVOCAR (lib/data/public-actions.ts)
   ---------------------------------------------------------------------
   Archivo "use server": cada función exportada es una acción a la que
   cualquiera puede llamar con un POST, aunque no use el formulario. Por eso
   aquí solo va lo que un componente del navegador necesita, validando la
   entrada y sin devolver datos personales (tarea 4.13, contrato §8).
   ===================================================================== */

"use server";

import { getBookedRangesByDate as readBookedRanges } from "./queries";
import type { BookedRange } from "@/lib/schedule";

/** "YYYY-MM-DD" que además es una fecha real (rechaza 2026-02-31 o textos). */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Rangos [inicio, fin) ocupados de un día, sin nombres ni ids, para el
 * BookingWizard. Con una fecha inválida devuelve [] (no hay nada que mostrar).
 */
export async function getBookedRangesByDate(date: string): Promise<BookedRange[]> {
  if (!isIsoDate(date)) return [];
  return readBookedRanges(date);
}
