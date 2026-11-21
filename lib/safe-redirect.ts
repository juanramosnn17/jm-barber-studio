/* =====================================================================
   DESTINO SEGURO TRAS EL LOGIN (lib/safe-redirect.ts)
   ---------------------------------------------------------------------
   Tarea 4.13 (auditoría, hallazgo 7). `return_url` / `next` llegan en la URL
   y los controla quien arma el enlace: sin validar, permiten un "open
   redirect" (iniciar sesión aquí y terminar en un sitio falso). Lo usan
   loginAction y proxy.ts para que ambos apliquen la MISMA regla.
   ===================================================================== */

/** Origen de referencia para interpretar rutas relativas cuando no se conoce el real. */
const FALLBACK_ORIGIN = "http://localhost";

/**
 * Devuelve la ruta interna (`/cliente?serviceId=…#booking-flow`) si `raw` es un
 * destino seguro, o `null` si no lo es. Reglas:
 *  - empieza con "/" y NO con "//" (eso sería otro dominio);
 *  - no contiene "\" (los navegadores convierten "/\sitio.com" en "//sitio.com")
 *    ni caracteres de control (tabulador, saltos de línea);
 *  - al interpretarla, el origen sigue siendo el mismo.
 */
export function safeReturnPath(raw: unknown, origin: string = FALLBACK_ORIGIN): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;

  let target: URL;
  try {
    target = new URL(value, origin);
  } catch {
    return null;
  }
  if (target.origin !== new URL(origin).origin) return null;
  return `${target.pathname}${target.search}${target.hash}`;
}
