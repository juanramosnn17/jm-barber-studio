/* =====================================================================
   CLIENTE DE SUPABASE PARA EL SERVIDOR (lib/supabase/server.ts)
   ---------------------------------------------------------------------
   Úsalo en:
     - Páginas y layouts del servidor (los que NO tienen "use client").
     - Server Actions (archivos con "use server").
     - Route Handlers (app/.../route.ts).

   IMPORTANTE: crea un cliente NUEVO en cada petición (no lo guardes en
   una variable global), porque cada visitante tiene su propia sesión.
   ===================================================================== */

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export async function createClient() {
  // En Next.js 16, cookies() es asíncrono: hay que usar "await".
  const cookieStore = await cookies();

  // DATOS DE SUPABASE: conexión desde el servidor leyendo/escribiendo la
  // sesión del usuario en las cookies del navegador.
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      // Lee todas las cookies de la petición actual
      getAll() {
        return cookieStore.getAll();
      },
      // Escribe las cookies nuevas (p. ej. al renovar la sesión)
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Si se llama desde un Server Component no se pueden escribir
          // cookies. No pasa nada: proxy.ts ya renueva la sesión.
        }
      },
    },
  });
}
