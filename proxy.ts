/* =====================================================================
   PROXY DE SEGURIDAD (proxy.ts)
   ---------------------------------------------------------------------
   Convención de Next.js 16 (antes "middleware.ts", tarea 3.14).
   Next.js ejecuta esta función antes de mostrar cada página que
   coincida con "matcher". Toda la lógica de validación de tokens,
   cookies y protección de rutas (/admin y /cliente) está en
   lib/supabase/proxy.ts.
   ===================================================================== */

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Se ejecuta en todas las rutas EXCEPTO archivos estáticos e imágenes
  // (no tiene sentido revisar la sesión para descargar un .jpg).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
