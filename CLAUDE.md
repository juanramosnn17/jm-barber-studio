@AGENTS.md

# Proyecto: JM Barber Studio

## Stack
- **Front:** Next.js `16.3.8` (App Router) + React `19.2.8` + TypeScript `5` + Tailwind CSS `v4` (`@tailwindcss/postcss`)
- **Back:** Next.js Server Actions (`lib/actions.ts`), Server Queries (`lib/data/queries.ts`) y Route Handlers (`app/api/`)
- **Base de datos y Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`, PostgreSQL con RLS en `supabase/schema.sql`) + Store híbrido en memoria (`lib/data/store.ts`)
- **Despliegue:** Vercel (front y funciones serverless) · Supabase (base de datos gestionada)

## Documentación (léela antes de cualquier cambio)
- Qué es el producto, usuarios y qué NO entra: `@docs/producto.md`
- Arquitectura, rutas, entidades y relaciones: `@docs/arquitectura.md`
- Identidad visual, paleta HEX y tipografía: `@docs/diseno/identidad-visual.md`
- Especificaciones y criterios de aceptación:
  - `@docs/specs/F1-catalogo-y-autenticacion.md`
  - `@docs/specs/F2-reserva-de-citas.md`
  - `@docs/specs/F3-agenda-diaria-admin.md`
  - `@docs/specs/F4-servicios-horarios-usuarios.md`
  - `@docs/specs/F5-contabilidad-y-ganancias.md`
- Plantilla para nuevas specs: `@docs/specs/F0-plantilla.md`
- Contrato de datos y API (backend): `@docs/contratos/api.md`
- Guía paso a paso del backend por prioridad: `GUIA_BACKEND.md`
- Referencias visuales: `docs/diseno/referencias/`
- Decisiones técnicas y supuestos: `@docs/decisiones.md`
- Cronograma y checklist de implementación: `@docs/tareas.md`
- Skill de construcción de interfaz: `@.claude/skills/ui-componentes/SKILL.md`

## Reglas de trabajo (Spec-Driven Development)
- **Primero el documento, después el código:** Si cambia una regla de negocio o criterio de aceptación, actualiza primero la spec en `docs/specs/` antes de editar código.
- **Una tarea a la vez:** Implementa una sola tarea de `docs/tareas.md`, verifica sus criterios de aceptación en el navegador y regístrala antes de pasar a la siguiente.
- **Respeta el alcance:** No agregues funcionalidades listadas en "Fuera del MVP" de `docs/producto.md`.
- **Preserva la arquitectura híbrida:** Toda lectura en `lib/data/queries.ts` y toda mutación en `lib/actions.ts` debe seguir funcionando tanto con Supabase (`isSupabaseConfigured()`) como con el store en memoria (`lib/data/store.ts`).
- **Seguridad:** Nunca escribas llaves o credenciales en el código; usa `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Respeta la validación de roles en `lib/supabase/proxy.ts` (`admin`, `barbero`, `cliente`).
- **Estado del backend:** front y backend terminados. La app publicada en Vercel usa el proyecto Supabase "Barberia JM" y los 18 criterios **[Back]** se cumplen (`docs/verificacion-back.md`). Toda tarea nueva se registra en `docs/tareas.md` y no se marca como hecha hasta verificar sus criterios en el navegador.
- **Reglas del backend (Supabase):** todo cambio de tabla, política RLS o función va primero en `supabase/schema.sql` y en `docs/contratos/api.md`, y luego se aplica al proyecto (puede usarse el conector MCP de Supabase). Las políticas usan `is_admin()` / `get_my_role()`, nunca una subconsulta directa a `profiles`. Cada Server Action valida el rol en el servidor y revisa el `error` de Supabase antes de responder `ok: true`. La `service_role` key nunca se usa en el código del cliente ni con prefijo `NEXT_PUBLIC_`.
- **Regla Next.js 16:** Mantén intacta la referencia a `@AGENTS.md` y consulta `node_modules/next/dist/docs/` ante dudas de APIs de Next.js 16 (ej. `searchParams` como `Promise`).

## Convenciones del código
- **Componentes:** Ubicados en `components/` agrupados por dominio (`accounting/`, `admin/`, `auth/`, `booking/`, `layout/`, `ui/`), nombrados en `PascalCase`.
- **Server vs. Client Components:** Las páginas en `app/` son Server Components asíncronos por defecto; solo los componentes interactivos en `components/` llevan `"use client"`.
- **Estilos:** Usa exclusivamente los tokens del tema definidos en `app/globals.css` (`bg-surface`, `bg-surface-container-lowest`, `text-on-surface`, `bg-primary`, `text-secondary`, `font-headline-lg`, `px-margin-mobile`, etc.).
- **Idioma y formato:** Todos los textos de la interfaz van en español (`es-CO`) y los valores monetarios se formatean en pesos colombianos (`COP`) mediante `formatPrice()` de `lib/format.ts`.
