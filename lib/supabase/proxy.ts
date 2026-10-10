/* =====================================================================
   RENOVACIÓN DE SESIÓN EN EL PROXY (lib/supabase/proxy.ts)
   ---------------------------------------------------------------------
   En Next.js 16, el antiguo "middleware" se llama "proxy". Se ejecuta
   ANTES de cada página. Lo usamos para:
     1. Renovar automáticamente la sesión de Supabase (tokens).
     2. Hacer una comprobación "optimista" de acceso: si alguien sin
        sesión intenta entrar a /cliente o /admin, lo enviamos a /login.

   La verificación del ROL (cliente / admin) se hace después, dentro de
   cada layout (app/admin/layout.tsx), que es más seguro.
   ===================================================================== */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

// EDITAR AQUÍ: rutas que requieren haber iniciado sesión.
const PROTECTED_PREFIXES = ["/cliente", "/admin"];

// EDITAR AQUÍ: rutas a las que NO debe volver alguien que ya inició sesión.
const AUTH_PAGES = ["/login", "/registro"];

export async function updateSession(request: NextRequest) {
  // Respuesta por defecto: dejar pasar la petición tal cual
  let response = NextResponse.next({ request });

  // DATOS DE SUPABASE Y LOCAL STORE:
  // Verificamos si existe la cookie de sesión local 'jm_user_session'
  const localSessionCookie = request.cookies.get("jm_user_session")?.value;
  let isLoggedIn = Boolean(localSessionCookie);

  // Si Supabase está configurado, renovamos sesión con tokens de Supabase
  if (isSupabaseConfigured()) {
    // DATOS DE SUPABASE: cliente especial que lee las cookies de la
    // petición y escribe las cookies renovadas en la respuesta.
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Evita que un CDN guarde en caché respuestas con cookies de sesión
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    });

    // IMPORTANTE: no escribas código entre createServerClient y getClaims().
    // getClaims() valida el token del usuario y lo renueva si caducó.
    const { data } = await supabase.auth.getClaims();
    if (Boolean(data?.claims)) {
      isLoggedIn = true;
    }
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => path.startsWith(p));

  // Sin sesión intentando entrar a una zona privada → a /login con return_url
  if (!isLoggedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("return_url", path); // Para volver aquí tras iniciar sesión
    return redirectWithCookies(url, response);
  }

  // Con sesión intentando ver /login o /registro → a la página de inicio o return_url
  if (isLoggedIn && isAuthPage) {
    const returnUrl = request.nextUrl.searchParams.get("return_url") || request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** Redirige conservando las cookies de sesión recién renovadas. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}
