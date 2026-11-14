# Contrato de datos y API · JM Barber Studio

> Documento del backend (Unidad 4). Describe **qué recibe, qué devuelve, qué tabla toca y qué rol puede usar** cada operación del servidor. Si un contrato cambia, se actualiza aquí **antes** de tocar `lib/actions.ts`, `lib/data/queries.ts` o `supabase/schema.sql`.

## Convenciones
- **Transporte:** no hay API REST propia salvo el reporte contable. Las mutaciones son **Server Actions** (`lib/actions.ts`, `"use server"`) y las lecturas son **funciones de servidor** (`lib/data/queries.ts`) llamadas desde páginas Server Component.
- **Respuesta estándar de mutaciones:** `ActionResult = { ok: boolean; message?: string }` (`lib/types.ts`). Los mensajes van en español y se muestran tal cual en la UI.
- **Modo dual:** cada operación funciona con Supabase si `isSupabaseConfigured()` es verdadero, y con el store en memoria (`lib/data/store.ts`) si no. El contrato es el mismo en ambos modos.
- **Autorización:** la protección de rutas está en `middleware.ts` → `lib/supabase/proxy.ts`. Con Supabase, la última barrera son las políticas **RLS** de `supabase/schema.sql`. Las Server Actions se pueden invocar directamente con un POST, así que **cada acción debe validar el rol en el servidor** (ver tarea 3.13).
- **Fechas y horas:** `date` = `YYYY-MM-DD`, `time` = `HH:MM` (24 h, hora de Colombia). **Dinero:** `numeric(10,2)` en COP, se formatea con `formatPrice()`.

## Enumeraciones (`lib/types.ts` = `check` en `schema.sql`)
| Tipo | Valores |
|---|---|
| `UserRole` | `cliente`, `barbero`, `admin` |
| `AppointmentStatus` | `pendiente`, `confirmada`, `en_curso`, `completada`, `cancelada` |
| `PaymentStatus` | `pendiente`, `pagado`, `reembolsado`, `anulado` |
| `PaymentMethod` | `efectivo`, `transferencia`, `tarjeta`, `nequi_daviplata` |
| `ExpenseCategory` | `arriendo`, `servicios_publicos`, `nomina_administrativa`, `insumos_generales`, `publicidad`, `mantenimiento`, `otros` |
| `ExpenseStatus` | `registrado`, `anulado` |

## Tablas (resumen)
| Tabla | Clave | Relaciones | Quién lee | Quién escribe |
|---|---|---|---|---|
| `profiles` | `id` = `auth.users.id` | 1 perfil por usuario de Auth (trigger `handle_new_user`) | el propio usuario; admin todos | el propio usuario; **admin todos (tarea 3.11)** |
| `services` | `id uuid` | referenciado por `appointments.service_id` (`on delete restrict`) | público si `is_active`; admin todos | admin |
| `business_hours` | `id = 1` (fila única) | — | público | admin |
| `appointments` | `id uuid` | `client_id → profiles`, `service_id → services` | dueño; admin y barbero todas | dueño crea; dueño/admin/barbero actualizan |
| `expenses` | `id uuid` | — | admin | admin |

Regla de negocio (spec F2): **una sola cita no cancelada por `(date, time)`**, garantizada con un índice único parcial (tarea 3.4).

## Lecturas (`lib/data/queries.ts`)
| Función | Entrada | Salida | Tabla | Rol |
|---|---|---|---|---|
| `getCurrentProfile` | `demoRoleFallback?` | `Profile \| null` | `profiles` | cualquiera con sesión |
| `getServices` | `{ onlyActive?: boolean }` | `Service[]` ordenados por `sort_order` | `services` | público (activos); admin (todos) |
| `getNextAppointment` | `clientId` | `AppointmentWithDetails \| null` | `appointments` + `services` | el propio cliente |
| `getAppointmentsByDate` | `date` | `AppointmentWithDetails[]` ordenadas por hora | `appointments` + `services` + `profiles` | admin, barbero |
| `getBookedSlotsByDate` | `date` | `string[]` horas `HH:MM` ocupadas | **RPC `get_booked_slots(date)`** (tarea 3.5) | cualquier cliente con sesión |
| `getBusinessHours` | — | `BusinessHours` | `business_hours` (id 1) | público |
| `getProfilesPage` | `page`, `pageSize` | `{ rows: Profile[]; total }` | `profiles` | admin |
| `getClientCount` | — | `number` | `profiles` | admin |

## Mutaciones (`lib/actions.ts`)
| Acción | Entrada | Efecto | Errores esperados (mensaje) | Rol |
|---|---|---|---|---|
| `loginAction` | FormData: `identifier`, `password`, `return_url?` | Inicia sesión y redirige a `/admin` o `/cliente` | `"Credenciales incorrectas. Verifica tu correo y contraseña o regístrate si aún no tienes cuenta."` | público |
| `registerAction` | FormData: `first_name`, `last_name`, `email`, `phone`, `password`, `confirm_password`, `reminders?` | Crea usuario en Auth + `profiles` (`role = 'cliente'`) y abre sesión | `"Las contraseñas no coinciden."` | público |
| `logoutAction` | — | Cierra sesión y redirige a `/login` | — | con sesión |
| `createAppointmentAction` | `serviceId`, `date`, `time`, `notes?` | Inserta cita `confirmada` → `{ ok, message?, appointmentId? }` | `"Faltan datos requeridos de la reserva."` · `"Este bloque horario ya está ocupado. Por favor elige otro turno."` (también ante error Postgres `23505`) | cliente |
| `updateAppointmentStatusAction` | `appointmentId`, `newStatus: AppointmentStatus` | Cambia estado; si es `completada` registra `payment_status = 'pagado'`, costo directo y comisión | — | admin, barbero |
| `assignAppointmentBarberAction` | `appointmentId`, `barberName`, `chair` | Asigna barbero y sillón | — | admin, barbero |
| `updateBusinessHoursAction` | `Partial<BusinessHours>` | Actualiza la fila `id = 1` | — | admin |
| `toggleServiceActiveAction` | `serviceId` | Invierte `is_active` | — | admin |
| `createServiceAction` | FormData: `name`, `short_name`, `description`, `includes`, `price`, `duration_label`, `duration_minutes`, `icon`, `image_url`, `custom_image_url` | Inserta servicio activo | — | admin |
| `updateUserAction` | `userId`, `{ first_name, last_name, email, phone?, role }` | Actualiza perfil y rol | — | admin |
| `deleteUserAction` | `userId` | Elimina el usuario (Auth + `profiles`, tarea 3.11) | — | admin |
| `createExpenseAction` | FormData: `date`, `category`, `concept`, `amount`, `payment_method`, `reference?` | Inserta gasto `registrado` | rechazo si no es admin | admin |

**Regla para todas las mutaciones con Supabase (tarea 3.12):** si Supabase devuelve `error`, la acción responde `{ ok: false, message }` y **no** confirma el cambio en el store en memoria; nunca muestra "listo" si no se guardó.

## Route Handler · Reporte contable
`/api/accounting/profit-report` (`app/api/accounting/profit-report/route.ts`), solo **admin**.

| Método | Entrada | Salida |
|---|---|---|
| `GET` | Query: `period` (`today`, `7d`, `30d`, `month`, `custom`), `startDate`, `endDate`, filtros de barbero, servicio, método y estado de pago, categoría de gasto; `format=csv` opcional | `200` JSON con resumen, series y transacciones, o `200` archivo `.csv` |
| `POST` | Cuerpo JSON con los mismos filtros | `200` JSON del reporte |

Códigos de error: `400` filtros inválidos · `401` sin sesión · `403` rol distinto de admin · `500` error interno.

## Funciones SQL previstas (pendientes)
| Función | Tipo | Propósito | Tarea |
|---|---|---|---|
| `is_admin()` / `get_my_role()` | `security definer`, `stable` | Leer el rol del usuario sin activar RLS de `profiles` (evita recursión infinita, error `42P17`) | 3.10 |
| `get_booked_slots(date)` | `security definer` | Devolver solo las horas ocupadas de una fecha, sin datos personales | 3.5 |
