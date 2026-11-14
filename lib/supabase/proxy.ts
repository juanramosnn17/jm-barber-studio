/* =====================================================================
   RENOVACIÓN DE SESIÓN Y PROTECCIÓN DE RUTAS (lib/supabase/proxy.ts)
   ---------------------------------------------------------------------
   Invocado por middleware.ts ANTES de cada página. Lo usamos para:
     1. Renovar y validar automáticamente la sesión de Supabase (tokens/cookies).
     2. Validar la cookie de sesión híbrida ('jm_user_session').
     3. Proteger las rutas privadas (/cliente y /admin): si alguien sin
        sesión válida intenta acceder, se redirige a /login.
   ===================================================================== */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { findUserById } from "@/lib/data/store";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

// Rutas que requieren haber iniciado sesión.
const PROTECTED_PREFIXES = ["/cliente", "/admin"];

// Rutas a las que NO debe volver alguien que ya inició sesión.
const AUTH_PAGES = ["/login", "/registro"];

export async function updateSession(request: NextRequest) {
  // Respuesta por defecto: dejar pasar la petición tal cual
  let response = NextResponse.next({ request });

  let isLoggedIn = false;
  let userRole: string | null = null;

  if (!isSupabaseConfigured()) {
    // MODO DEMO (sin Supabase): la sesión es la cookie local 'jm_user_session'
    const localSessionCookie = request.cookies.get("jm_user_session")?.value?.trim();
    isLoggedIn = Boolean(localSessionCookie);
    if (localSessionCookie) {
      const localUser = findUserById(localSessionCookie);
      if (localUser) {
        userRole = localUser.role;
      } else if (localSessionCookie === "user-admin") {
        userRole = "admin";
      } else if (localSessionCookie === "user-cliente") {
        userRole = "cliente";
      }
    }
  } else {
    // MODO SUPABASE: la cookie demo se ignora; sesión y rol salen de Supabase (tarea 3.15)
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

    // Validamos el token JWT y renovamos cookies si es necesario
    const [{ data: claimsData }, { data: userData }] = await Promise.all([
      supabase.auth.getClaims(),
      supabase.auth.getUser(),
    ]);

    if (Boolean(claimsData?.claims) || Boolean(userData?.user)) {
      isLoggedIn = true;
      // El rol se lee de la tabla profiles (get_my_role), nunca de user_metadata,
      // porque el propio usuario puede modificar sus metadatos.
      const { data: dbRole } = await supabase.rpc("get_my_role");
      userRole = typeof dbRole === "string" ? dbRole : null;
    }
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
  const isAuthPage = AUTH_PAGES.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  // Sin sesión intentando entrar a una zona privada (/admin o /cliente) → a /login con return_url
  if (!isLoggedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("return_url", path);
    return redirectWithCookies(url, response);
  }

  // /admin solo admite 'admin' y 'barbero'; cualquier otro rol (o sin rol) → /cliente
  if (
    isLoggedIn &&
    path.startsWith("/admin") &&
    userRole !== "admin" &&
    userRole !== "barbero"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/cliente";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  // Contabilidad, servicios, horarios y usuarios son exclusivos del rol 'admin'
  // (barberos redirigidos a /admin). Spec F4 "Permisos por rol", tarea 3.21.
  const ADMIN_ONLY_PREFIXES = [
    "/admin/contabilidad",
    "/admin/servicios",
    "/admin/horarios",
    "/admin/usuarios",
  ];
  if (
    isLoggedIn &&
    ADMIN_ONLY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) &&
    userRole !== "admin"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = userRole === "barbero" ? "/admin" : "/cliente";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  // Con sesión intentando ver /login o /registro → a su panel o return_url
  if (isLoggedIn && isAuthPage) {
    const returnUrl =
      request.nextUrl.searchParams.get("return_url") ||
      request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    if (returnUrl && returnUrl.startsWith("/")) {
      url.pathname = returnUrl;
    } else if (userRole === "admin" || userRole === "barbero") {
      url.pathname = "/admin";
    } else {
      url.pathname = "/cliente";
    }
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

