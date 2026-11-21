@AGENTS.md

# Proyecto: JM Barber Studio

## Stack
- **Front:** Next.js `16.3.8` (App Router) + React `19.2.8` + TypeScript `5` + Tailwind CSS `v4` (`@tailwindcss/postcss`)
- **Back (principal):** API REST en **Spring Boot 4.2 + Java 21 + MySQL + Flyway + Spring Security (JWT)** en `backend/`. Contrato: `@docs/contratos/api-rest.md`. Next.js la llama desde el servidor mediante `lib/api/` cuando está definida `API_URL` (tarea 4.9).
- **Capa de servidor del front:** Server Actions (`lib/actions.ts`), consultas (`lib/data/queries.ts`) y Route Handlers (`app/api/`). Cada una elige el modo en este orden: API Spring Boot → Supabase → store en memoria (`lib/data/store.ts`).
- **Supabase (solo producción actual):** el sitio de Vercel usa el proyecto "Barberia JM", con el esquema aplicado por migraciones MCP (`supabase/schema.sql`), hasta que la API se publique en la nube (U6). Se retira en la tarea 4.11.
- **Despliegue:** Vercel (front). La API Spring Boot corre en local (`http://localhost:8080`) y quedó lista para desplegarse en **Render** (Docker, `backend/Dockerfile` + `render.yaml`, guía en `@docs/operacion/despliegue-render.md`) o AWS/Railway sin cambiar código.

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
- Modelo de datos (entidades, restricciones y dueños): `@docs/datos/modelo.md`
- Contrato de datos y API (backend): `@docs/contratos/api.md`
- Contrato API REST del backend Spring Boot: `@docs/contratos/api-rest.md`
- Guía paso a paso del backend por prioridad: `GUIA_BACKEND.md`
- Guía de despliegue Spring Boot en Render: `@docs/operacion/despliegue-render.md`
- Referencias visuales: `docs/diseno/referencias/`
- Decisiones técnicas y supuestos: `@docs/decisiones.md`
- Cronograma y checklist de implementación: `@docs/tareas.md`
- Skill de construcción de interfaz: `@.claude/skills/ui-componentes/SKILL.md`
- Skill de seguridad y datos: `@.claude/skills/backend-seguro/SKILL.md`

## Backend
- **Stack del MVP (U4):** **Spring Boot + MySQL** (decisión del estudiante del 2026-11-21, que la guía M4·U4 permite: *"el contrato y las cerraduras son los mismos, cambia quién lo implementa"*). El plan T-B sobre Supabase que hizo Antigravity queda reemplazado (ver `docs/decisiones.md`).
- **Fuente de verdad:** `@docs/datos/modelo.md` (modelo y reglas) y `@docs/contratos/api-rest.md` (contrato de la API). `docs/contratos/api.md` describe la versión Supabase que hoy sirve a Vercel. Primero el contrato, luego el código; si algo no está en el contrato, preguntar antes de implementar.
- **Regla obligatoria:** aplica SIEMPRE la skill `backend-seguro` (`@.claude/skills/backend-seguro/SKILL.md`) al tocar tablas, migraciones, endpoints, Server Actions o consultas de datos. En Spring Boot las "cerraduras" son Spring Security (roles), la validación de dueño en la capa `Service`, Bean Validation y las restricciones de MySQL.
- **Migraciones:** en Spring Boot, cada cambio de esquema es una migración Flyway nueva en `backend/src/main/resources/db/migration/` (nunca se edita una aplicada). En Supabase, ningún SQL se aplica sin mostrar el script completo y recibir aprobación; `supabase/migrations/20261120000000_esquema_mvp.sql` es un diseño **no aplicado**.
- **Secretos:** nunca escribir llaves o tokens en el código; usar variables de entorno (`.env.local` fuera de Git) y jamás exponer `service_role` con `NEXT_PUBLIC_`.

## Reglas de trabajo (Spec-Driven Development)
- **Primero el documento, después el código:** Si cambia una regla de negocio o criterio de aceptación, actualiza primero la spec en `docs/specs/` antes de editar código.
- **Una tarea a la vez:** Implementa una sola tarea de `docs/tareas.md`, verifica sus criterios de aceptación en el navegador y regístrala antes de pasar a la siguiente.
- **Respeta el alcance:** No agregues funcionalidades listadas en "Fuera del MVP" de `docs/producto.md`.
- **Preserva los modos de datos:** toda lectura en `lib/data/queries.ts` y toda mutación en `lib/actions.ts` debe seguir funcionando con la API (`isApiConfigured()`), con Supabase (`isSupabaseConfigured()`) y con el store en memoria (`lib/data/store.ts`), hasta que la 4.11 retire Supabase. Las funciones que solo existen en Spring Boot (3.29–3.31) se muestran solo en modo API.
- **Seguridad:** Nunca escribas llaves o credenciales en el código; usa `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Respeta la validación de roles en `lib/supabase/proxy.ts` (`admin`, `barbero`, `cliente`).
- **Estado del backend:** la API Spring Boot tiene las tareas 4.1–4.9 hechas (Next.js ya la usa con `API_URL`); siguen la 4.12 (alineación con `modelo.md` y la auditoría), la 4.10 (verificación completa) y la 4.11 (retirar Supabase). La app publicada en Vercel usa el proyecto Supabase "Barberia JM", donde se cumplen los 18 criterios **[Back]** (`docs/verificacion-back.md`). Toda tarea nueva se registra en `docs/tareas.md` y no se marca como hecha hasta verificar sus criterios en el navegador.
- **Reglas del backend (Supabase):** todo cambio de tabla, política RLS o función va primero en `supabase/schema.sql` y en `docs/contratos/api.md`, y luego se aplica al proyecto (puede usarse el conector MCP de Supabase). Las políticas usan `is_admin()` / `get_my_role()`, nunca una subconsulta directa a `profiles`. Cada Server Action valida el rol en el servidor y revisa el `error` de Supabase antes de responder `ok: true`. La `service_role` key nunca se usa en el código del cliente ni con prefijo `NEXT_PUBLIC_`.
- **Reglas del backend Spring Boot:** cada endpoint va primero en `docs/contratos/api-rest.md`; cada cambio de tabla es una migración Flyway nueva (nunca se edita una ya aplicada); credenciales y `JWT_SECRET` solo en variables de entorno; roles validados con Spring Security y la validación de dueño en la capa `Service`; errores siempre `{ status, code, message }` en español. Se ejecuta con `backend/mvnw` (Java 21).
- **Regla Next.js 16:** Mantén intacta la referencia a `@AGENTS.md` y consulta `node_modules/next/dist/docs/` ante dudas de APIs de Next.js 16 (ej. `searchParams` como `Promise`).

## Convenciones del código
- **Componentes:** Ubicados en `components/` agrupados por dominio (`accounting/`, `admin/`, `auth/`, `booking/`, `layout/`, `ui/`), nombrados en `PascalCase`.
- **Server vs. Client Components:** Las páginas en `app/` son Server Components asíncronos por defecto; solo los componentes interactivos en `components/` llevan `"use client"`.
- **Estilos:** Usa exclusivamente los tokens del tema definidos en `app/globals.css` (`bg-surface`, `bg-surface-container-lowest`, `text-on-surface`, `bg-primary`, `text-secondary`, `font-headline-lg`, `px-margin-mobile`, etc.).
- **Idioma y formato:** Todos los textos de la interfaz van en español (`es-CO`) y los valores monetarios se formatean en pesos colombianos (`COP`) mediante `formatPrice()` de `lib/format.ts`.
