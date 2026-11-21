/* =====================================================================
   CONFIGURACIÓN DE LA API SPRING BOOT (lib/api/config.ts)
   ---------------------------------------------------------------------
   API_URL es una variable SOLO del servidor (sin NEXT_PUBLIC_): el
   navegador nunca habla directo con la API; lo hacen las Server Actions,
   las páginas y proxy.ts. En local: API_URL=http://localhost:8080
   (docs/contratos/api-rest.md §8, tarea 4.9).
   ===================================================================== */

export const API_URL = (process.env.API_URL ?? "").trim().replace(/\/+$/, "");

/** Nombre de la cookie httpOnly que guarda el JWT de la API. */
export const API_TOKEN_COOKIE = "jm_api_token";

/** Duración de la cookie: igual que el token (jwt.expiration-hours=168). */
export const API_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

/** true cuando la app debe usar el backend Spring Boot (tiene prioridad sobre Supabase). */
export function isApiConfigured(): boolean {
  return API_URL.startsWith("http");
}
