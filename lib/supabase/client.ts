/* =====================================================================
   CLIENTE DE SUPABASE PARA EL NAVEGADOR (lib/supabase/client.ts)
   ---------------------------------------------------------------------
   Úsalo SOLO dentro de componentes con "use client" (los que tienen
   botones, estados, etc.). Guarda la sesión del usuario en cookies
   para que el servidor también la pueda leer.

   Ejemplo de uso:
     const supabase = createClient();
     const { data } = await supabase.from("services").select("*");
   ===================================================================== */

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export function createClient() {
  // DATOS DE SUPABASE: conexión desde el navegador con la clave pública.
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
