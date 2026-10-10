/* =====================================================================
   VARIABLES DE ENTORNO DE SUPABASE (lib/supabase/env.ts)
   ---------------------------------------------------------------------
   Lee las credenciales de Supabase desde el archivo .env.local.
   Si todavía no las has configurado, la app funciona en
   "MODO DEMOSTRACIÓN" usando datos de ejemplo (lib/data/mock.ts),
   así puedes ver y probar el diseño sin base de datos.
   ===================================================================== */

// DATOS DE SUPABASE: URL de tu proyecto (Supabase → Project Settings → API).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// DATOS DE SUPABASE: clave pública "anon" (es segura en el navegador porque
// las reglas RLS de la base de datos limitan lo que puede hacer).
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Devuelve true si las dos variables de Supabase están definidas. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
}
