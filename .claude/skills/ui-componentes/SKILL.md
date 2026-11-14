---
name: ui-componentes
description: Crear o modificar componentes y pantallas de la interfaz de JM Barber Studio respetando el sistema de diseño "Sartorial Grooming System" (Tailwind v4). Úsala cada vez que una tarea toque páginas en app/ o componentes en components/.
---

# Cómo construimos UI en JM Barber Studio

1. **Lee la identidad visual primero:** Antes de crear o modificar estilos, revisa `docs/diseno/identidad-visual.md` y los tokens declarados dentro de `@theme` en `app/globals.css`.
2. **Usa los tokens semánticos del tema (no colores arbitrarios):**
   - Lienzo general de página: `bg-surface` (`#FCF9F2`) y texto `text-on-surface` (`#1C1C18`).
   - Tarjetas y contenedores principales: `bg-surface-container-lowest` (`#FFFFFF`), `rounded-2xl` o `rounded-3xl`, borde `border border-surface-container-high/60` y sombra `shadow-sm`.
   - Botones primarios: `rounded-full bg-primary text-on-primary hover:bg-neutral-800 transition-all`.
   - Acentos, precios y etiquetas destacadas: `text-secondary` (`#775A00`) o `text-secondary-fixed` (`#FFDF98`) sobre fondos oscuros.
   - Estados de error: `bg-error-container text-on-error-container` (`#FFDAD6` / `#93000A`).
3. **Usa la escala tipográfica y de espaciado del proyecto:**
   - Títulos y textos: `font-display-lg`, `font-headline-lg`, `font-headline-md`, `font-title-lg`, `font-body-md`, `font-body-sm`, `font-label-lg`, `font-label-md`, `font-label-sm`.
   - Márgenes horizontales de página: `max-w-[1440px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin`.
   - Separaciones internas: `gap-space-sm`, `gap-space-md`, `gap-space-lg`, `gap-space-xl`.
4. **Iconografía:**
   - Usa la fuente `Material Symbols Outlined` mediante `<span className="material-symbols-outlined">nombre_icono</span>` (y agrega `.icon-filled` cuando requiera relleno sólido).
5. **Estructura y arquitectura de componentes:**
   - Ubica cada componente en su subcarpeta de dominio dentro de `components/` (`auth/`, `booking/`, `admin/`, `accounting/`, `layout/`, `ui/`), en `PascalCase` y con interfaz de props tipada en TypeScript.
   - Mantén las páginas de `app/` como Server Components que obtienen datos mediante `lib/data/queries.ts` y pasa los datos serializados a Client Components (`"use client"`) que invocan Server Actions de `lib/actions.ts`.
   - Formatea siempre precios con `formatPrice()` y fechas con las utilidades de `lib/format.ts`.
6. **Responsividad y accesibilidad mínima:**
   - Diseño *Mobile First* (verifica a `390px` de ancho antes de escalar a `md:` y `lg:`).
   - Inputs con `<label htmlFor="...">` asociado, botones con área táctil mínima de `44px` (`h-11` / `h-12` o `py-2.5` / `py-3.5`) e imágenes de `next/image` con atributo `alt`.
   - Contempla siempre estados de carga (`isPending` / `loading.tsx`), estado vacío (ej. sin citas o sin transacciones) y mensajes de retroalimentación (`ok` / `error`).
