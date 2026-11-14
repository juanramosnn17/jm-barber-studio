# Arquitectura · JM Barber Studio

## Visión general
Aplicación web Full-Stack monolítica construida sobre **Next.js 16 (App Router)** con arquitectura híbrida:
`Cliente (React 19 / Server & Client Components)` → `Server Actions & Route Handlers (Next.js)` → `Persistencia Híbrida: Supabase (PostgreSQL + Auth + RLS) + Store Reactivo en Memoria (lib/data/store.ts)`.

## Stack tecnológico real
- **Frontend:** Next.js `16.3.8` (App Router), React `19.2.8`, TypeScript `5`.
- **Estilos y UI:** Tailwind CSS `v4` (`@tailwindcss/postcss`), sistema de diseño *Sartorial Grooming System* (basado en tokens Material Design 3 en `app/globals.css`), tipografía `Plus Jakarta Sans` (`next/font/google`) e iconografía `Material Symbols Outlined`.
- **Backend y Lógica de Negocio:** Next.js Server Actions (`lib/actions.ts`), Server Queries con `React.cache` (`lib/data/queries.ts`) y API Route Handler (`app/api/accounting/profit-report/route.ts`).
- **Base de Datos y Autenticación:** Supabase (`@supabase/supabase-js` y `@supabase/ssr`) con PostgreSQL, Row Level Security (RLS) y trigger automático de creación de perfiles (`supabase/schema.sql`), complementado con un almacén en memoria (`globalThis.__jm_store` en `lib/data/store.ts`) y sesión por cookie HTTP-only (`jm_user_session`) para funcionamiento inmediato en modo demostración o sin conexión a Supabase.

## Estructura de carpetas
```text
jm-barber-studio-main/
├── app/                                      # Rutas y páginas (Next.js App Router)
│   ├── admin/                                # Panel administrativo y operativo
│   │   ├── contabilidad/ganancias/           # F5: Reporte financiero y gastos
│   │   ├── horarios/                         # F4: Configuración de jornada laboral
│   │   ├── servicios/                        # F4: Catálogo de servicios
│   │   ├── usuarios/                         # F4: Gestión de perfiles y roles
│   │   └── page.tsx                          # F3: Tablero de citas del día y KPIs
│   ├── api/accounting/profit-report/route.ts # Endpoint GET JSON/CSV del reporte contable
│   ├── cliente/page.tsx                      # F2: Área privada del cliente y BookingWizard
│   ├── login/page.tsx                        # F1: Inicio de sesión
│   ├── registro/page.tsx                     # F1: Registro de nuevos clientes
│   ├── globals.css                           # Tokens de diseño (@theme Tailwind v4)
│   ├── layout.tsx                            # Layout raíz, fuentes y metadatos
│   └── page.tsx                              # F1: Landing page pública con catálogo
├── components/                               # Componentes de interfaz por dominio
│   ├── accounting/                           # Gráficas, tarjetas KPI, filtros y tabla contable
│   ├── admin/                                # Sidebar, lista de citas, gestores de servicios/horarios/usuarios
│   ├── auth/                                 # LoginForm y RegisterForm
│   ├── booking/                              # BookingWizard (4 pasos) y NextAppointmentCard
│   ├── layout/                               # AppHeader, AuthHeader y Footer
│   └── ui/                                   # BrandLogo
├── lib/                                      # Lógica de negocio, datos y utilidades
│   ├── accounting/                           # Motor de cálculo, validación, exportación CSV y repositorio
│   ├── auth/session.ts                       # Gestión de cookie de sesión local/híbrida
│   ├── data/                                 # queries.ts, store.ts (memoria) y mock.ts (semilla)
│   ├── supabase/                             # Clientes browser/server, variables de entorno y proxy middleware
│   ├── actions.ts                            # Server Actions (mutaciones de citas, usuarios, servicios, gastos)
│   ├── config.ts                             # Configuración regional (COP, es-CO, America/Bogota)
│   ├── format.ts                             # Formateadores de moneda y fechas ISO
│   ├── schedule.ts                           # Algoritmo generador de bloques horarios disponibles
│   └── types.ts                              # Contratos e interfaces TypeScript
├── supabase/schema.sql                       # Script DDL PostgreSQL, políticas RLS, triggers y datos semilla
├── tests/accounting/profit-report.test.ts    # Pruebas unitarias del motor financiero
└── middleware.ts                             # Protección de rutas y control de acceso por rol
```

## Mapa de rutas y control de acceso (`middleware.ts` + `lib/supabase/proxy.ts`)
| Ruta | Acceso | Propósito |
|---|---|---|
| `/` | Público | Portada del estudio y vitrina de servicios activos |
| `/login` y `/registro` | Público (redirige a su panel si ya hay sesión) | Autenticación y alta de clientes |
| `/cliente` | Autenticado (`cliente`, `admin`, `barbero`) | Próxima cita reservada y asistente de agendamiento |
| `/admin` | Autenticado (`admin`, `barbero`) | Control de citas del día, estados y asignación de sillón |
| `/admin/horarios` | Autenticado (`admin`, `barbero`) | Configuración de días abiertos, apertura/cierre y almuerzo |
| `/admin/servicios` | Autenticado (`admin`, `barbero`) | Creación y activación/desactivación de servicios |
| `/admin/usuarios` | Autenticado (`admin`, `barbero`) | Directorio paginado de usuarios, edición de rol y eliminación |
| `/admin/contabilidad/ganancias` | Exclusivo `admin` (redirige `barbero` a `/admin`) | Dashboard financiero, registro de gastos y descarga CSV |
| `/api/accounting/profit-report` | Exclusivo `admin` | API REST para consulta JSON o descarga `?format=csv` |

## Entidades de datos y relaciones (`supabase/schema.sql` y `lib/types.ts`)
1. **`profiles` (Usuarios):** `id (PK, FK auth.users)`, `first_name`, `last_name`, `email`, `phone`, `role ('cliente' | 'barbero' | 'admin')`, `avatar_url`, `reminders_opt_in`.
2. **`services` (Catálogo de Servicios):** `id (PK)`, `name`, `short_name`, `description`, `includes`, `price`, `direct_cost`, `commission_percentage`, `duration_label`, `duration_minutes`, `image_url`, `icon`, `is_active`, `sort_order`.
3. **`business_hours` (Horario de Atención):** `id (PK = 1)`, `open_days (int[])`, `open_time`, `close_time`, `break_start`, `break_end`, `slot_minutes`, `barbers_count`.
4. **`appointments` (Citas e Ingresos):** `id (PK)`, `client_id (FK profiles.id)`, `service_id (FK services.id)`, `barber_name`, `chair`, `date`, `time`, `status ('pendiente' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada')`, `notes`, `payment_status`, `payment_method`, `gross_amount`, `discount_amount`, `refund_amount`, `tip_amount`, `direct_cost_amount`, `commission_amount`, `paid_at`.
5. **`expenses` (Gastos Operativos):** `id (PK)`, `date`, `time`, `category`, `concept`, `amount`, `payment_method`, `status ('registrado' | 'anulado')`, `reference`, `notes`.

**Relaciones principales:**
- `profiles (1) ─── (N) appointments`: Un cliente puede tener múltiples citas reservadas (`client_id`).
- `services (1) ─── (N) appointments`: Un servicio del catálogo está asociado a múltiples citas (`service_id`).
- `business_hours (1)` gobierna la generación de franjas horarias válidas para todas las `appointments`.

## Despliegue
- **Frontend y Backend Serverless:** Diseñado para despliegue directo en **Vercel** (detección automática de Next.js App Router).
- **Base de datos y Auth en la nube:** **Supabase** (configurado mediante variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Si no se definen en el entorno de despliegue, el sistema opera automáticamente sobre el store en memoria (`lib/data/store.ts`) con datos semilla precargados.
- **Estado actual (2026-11-14):** el front está publicado en https://jm-barber-studio-delta.vercel.app con despliegue continuo desde `main` de GitHub, en **modo demo** (sin variables de Supabase). La conexión con Supabase en la nube está planificada en `docs/tareas.md` → "Back · Supabase en la nube" (tareas 3.1–3.14). El contrato de cada operación del servidor está en `docs/contratos/api.md`.
