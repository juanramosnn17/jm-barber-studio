/* =====================================================================
   CLIENTE HTTP DE LA API (lib/api/client.ts)
   ---------------------------------------------------------------------
   Toda llamada a Spring Boot pasa por aquí. Agrega el JWT de la cookie
   httpOnly y traduce la respuesta a { ok, data } o { ok: false, message }
   con el mensaje en español que envía la API ({ status, code, message }).
   ===================================================================== */

import "server-only";
import { cookies } from "next/headers";
import { API_TOKEN_COOKIE, API_TOKEN_MAX_AGE, API_URL } from "./config";

export const API_UNAVAILABLE_MESSAGE =
  "No se pudo conectar con el servidor. Inténtalo de nuevo en unos minutos.";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string };

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Token explícito (p. ej. justo después del login, antes de que exista la cookie). */
  token?: string;
};

async function currentToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(API_TOKEN_COOKIE)?.value || undefined;
}

/** Llama a /api/v1{path} y devuelve el JSON ya interpretado. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const token = options.token ?? (await currentToken());
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    console.error(`API no disponible (${path}):`, err instanceof Error ? err.message : err);
    return { ok: false, status: 503, code: "API_UNAVAILABLE", message: API_UNAVAILABLE_MESSAGE };
  }

  if (res.status === 204) return { ok: true, status: 204, data: undefined as T };

  const payload = await res.json().catch(() => null);
  if (res.ok) return { ok: true, status: res.status, data: payload as T };

  const error = (payload ?? {}) as { code?: string; message?: string };
  return {
    ok: false,
    status: res.status,
    code: error.code ?? "ERROR",
    message: error.message ?? "No se pudo completar la operación. Inténtalo de nuevo.",
  };
}

/** Descarga un archivo (CSV) de la API con el token del usuario. */
export async function apiDownload(path: string): Promise<Response | null> {
  const token = await currentToken();
  try {
    return await fetch(`${API_URL}/api/v1${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

/** Guarda el JWT en una cookie httpOnly: el JavaScript del navegador no puede leerlo. */
export async function setApiToken(token: string) {
  const jar = await cookies();
  jar.set(API_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: API_TOKEN_MAX_AGE,
  });
}

export async function clearApiToken() {
  const jar = await cookies();
  jar.delete(API_TOKEN_COOKIE);
}
