/* =====================================================================
   CONFIGURACIÓN GENERAL DEL SITIO (lib/config.ts)
   ---------------------------------------------------------------------
   Reúne en un solo lugar los textos y valores que un dueño de negocio
   podría querer cambiar sin tocar el resto del código.
   ===================================================================== */

export const siteConfig = {
  // EDITAR AQUÍ: Nombre comercial que aparece en textos y pie de página.
  name: "JM Barber Studio",

  // EDITAR AQUÍ: Año que se muestra en el aviso de derechos reservados.
  copyrightYear: 2026,

  // EDITAR AQUÍ: Prefijo telefónico del país (se muestra en el registro).
  phonePrefix: "+57",

  // EDITAR AQUÍ: Moneda y formato regional de los precios.
  //   - "COP" + "es-CO" → $ 25.000
  //   - "EUR" + "es-ES" → 25,00 €
  currency: "COP",
  locale: "es-CO",

  // EDITAR AQUÍ: Correo de ejemplo que aparece en el campo de inicio de sesión.
  loginPlaceholder: "cliente@jmbarber.com",
} as const;

/* ---------------------------------------------------------------------
   HORARIOS DE RESERVA (valores por defecto)
   Se usan cuando Supabase todavía no está conectado o cuando no hay
   horarios guardados en la tabla "business_hours".
   --------------------------------------------------------------------- */
export const defaultSchedule = {
  // EDITAR AQUÍ: Días que abre la barbería (0 = domingo, 1 = lunes ... 6 = sábado).
  openDays: [1, 2, 3, 4, 5, 6],
  // EDITAR AQUÍ: Hora de apertura y cierre (formato 24 h "HH:MM").
  openTime: "09:00",
  closeTime: "20:00",
  // EDITAR AQUÍ: Pausa de almuerzo (no se ofrecen citas en esta franja).
  breakStart: "14:00",
  breakEnd: "15:00",
  // EDITAR AQUÍ: Cada cuántos minutos se ofrece un turno (30 = 9:00, 9:30, 10:00...).
  slotMinutes: 30,
};
