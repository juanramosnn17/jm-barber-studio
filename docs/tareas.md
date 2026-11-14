# Tareas · JM Barber Studio

## Front y Base de Diseño (U3)
- [x] 1.1 Configurar layout raíz (`app/layout.tsx`), fuente `Plus Jakarta Sans`, iconos `Material Symbols` y tokens de identidad visual en `app/globals.css` (`@theme` Tailwind v4).
- [x] 1.2 Crear componentes transversales de navegación e identidad: `BrandLogo`, `AppHeader`, `AuthHeader`, `AdminSidebar` y `Footer`.
- [x] 1.3 Definir contratos de datos TypeScript (`lib/types.ts`), configuración regional (`lib/config.ts`), formateadores (`lib/format.ts`) y semilla de datos mock (`lib/data/mock.ts`).
- [x] 1.4 **F1 · Portada y Catálogo:** Construir la página de inicio (`app/page.tsx`) con sección hero, llamadas a la acción y grilla de servicios activos.
- [x] 1.5 **F1 · Autenticación:** Construir las páginas `/login` (`LoginForm.tsx`) y `/registro` (`RegisterForm.tsx`) con validación de campos y pestañas Cliente / Staff.
- [x] 1.6 **F2 · Área del Cliente y Reserva:** Construir `/cliente` con tarjeta de próxima cita (`NextAppointmentCard.tsx`), cálculo de franjas libres (`lib/schedule.ts`) y asistente de reserva en 4 pasos (`BookingWizard.tsx`).
- [x] 1.7 **F3 · Agenda Diaria Admin:** Construir `/admin` con tarjetas KPI de la jornada y lista interactiva de citas (`DailyAppointmentsList.tsx`) para cambio de estados y asignación de barbero/sillón.
- [x] 1.8 **F4 · Gestión de Negocio:** Construir las vistas y componentes de configuración de horarios (`/admin/horarios` · `ScheduleConfig.tsx`), catálogo de servicios (`/admin/servicios` · `ServicesManager.tsx`) y directorio paginado de usuarios (`/admin/usuarios` · `UsersTable.tsx`).
- [x] 1.9 **F5 · Interfaz de Contabilidad y Ganancias:** Construir `/admin/contabilidad/ganancias` con filtros (`ProfitReportFilters.tsx`), tarjetas de resumen con comparativa (`ProfitSummaryCards.tsx`), gráficas de tendencia y desglose (`ProfitTrendChart.tsx`, `RevenueBreakdownChart.tsx`, `ExpenseBreakdownChart.tsx`), formulario de gastos y tabla auditable (`AccountingTransactionsTable.tsx`).

## Back · Código preparado en Next.js (hecho, funciona en modo demo)
> Estas tareas dejan el código listo para Supabase, pero **la base de datos en la nube aún no está conectada**: hoy la app (local y en Vercel) corre sobre el store en memoria. La conexión real se planifica en la sección siguiente.

- [x] 2.1 Definir esquema SQL en `supabase/schema.sql` (tablas `profiles`, `services`, `business_hours`, `appointments`, `expenses`, políticas RLS, trigger `handle_new_user` y datos semilla).
- [x] 2.2 Implementar almacén reactivo en memoria (`lib/data/store.ts`) y gestión de sesión por cookies (`lib/auth/session.ts`) para soporte híbrido Demo + Supabase.
- [x] 2.3 Implementar clientes de Supabase (`lib/supabase/client.ts`, `server.ts`, `env.ts`) y middleware de protección de rutas por rol (`middleware.ts` y `lib/supabase/proxy.ts`).
- [x] 2.4 Implementar capa de lecturas del servidor (`lib/data/queries.ts`) y Server Actions de mutación (`lib/actions.ts`) con prevención de overbooking y `revalidatePath`.
- [x] 2.5 Implementar motor financiero (`lib/accounting/profit-report.*.ts`), endpoint de exportación CSV (`app/api/accounting/profit-report/route.ts`) y pruebas unitarias (`tests/accounting/profit-report.test.ts`).

## Back · Supabase en la nube (pendiente)
> Regla: una tarea a la vez; al terminar cada una se verifican en el navegador los criterios marcados **[Back]** en `docs/specs/` y se marca aquí. Se puede apoyar en el conector MCP de Supabase. El contrato de cada operación está en `docs/contratos/api.md`.
> Orden de ejecución por prioridad (detalle en `GUIA_BACKEND.md`): 3.10 → 3.1 → 3.2 → 3.3 → 3.7 → 3.4/3.5/3.6 → 3.12 → 3.13 → 3.11 → 3.8 → 3.9 → 3.14.

- [x] 3.1 Proyecto Supabase listo: se reactivó el proyecto existente "Barberia JM" (`rlptxllgviigshgoihyh`, región `us-west-2`). La URL y la anon key van en `.env.local` (nunca en el código) en el paso 4.
- [x] 3.2 Ejecutar `supabase/schema.sql` en el proyecto y comprobar en el Table Editor las 5 tablas (`profiles`, `services`, `business_hours`, `appointments`, `expenses`) con RLS activo y los datos semilla de servicios y horario.
- [x] 3.3 Configurar Supabase Auth: proveedor correo/contraseña activo, confirmación de correo desactivada para el MVP y `Site URL` = `https://jm-barber-studio-delta.vercel.app` (más `http://localhost:3000` en Redirect URLs).
- [x] 3.4 Actualizar la spec F2 y luego `supabase/schema.sql`: índice único parcial en `appointments (date, time)` donde `status <> 'cancelada'`, para que la base de datos impida el overbooking.
- [x] 3.5 Agregar al esquema una función `get_booked_slots(date)` (`security definer`) que devuelva solo las horas ocupadas, para que el cliente vea la disponibilidad real sin poder leer citas ajenas (RLS).
- [x] 3.6 Ajustar `lib/data/queries.ts` y `createAppointmentAction` (`lib/actions.ts`) para usar `get_booked_slots` y traducir el error de unicidad de Postgres (`23505`) al mensaje `"Este bloque horario ya está ocupado. Por favor elige otro turno."`, manteniendo intacto el modo demo.
- [x] 3.10 Agregar a `schema.sql` las funciones `is_admin()` y `get_my_role()` (`security definer`, `stable`) y reescribir todas las políticas RLS para usarlas en lugar de `(select role from profiles ...)`, que provoca recursión infinita (`42P17`). Verificar que `/` carga los servicios con Supabase conectado.
- [ ] 3.11 Agregar políticas para que el admin pueda **editar** cualquier perfil y una función `delete_user(id)` (`security definer`, solo admin) que borre el usuario de `auth.users` (y en cascada su perfil); ajustar `deleteUserAction` para usarla.
- [x] 3.12 En cada mutación de `lib/actions.ts`, revisar el `error` que devuelve Supabase: si falla, responder `{ ok: false, message }` y no confirmar el cambio en el store en memoria. Hecho junto con 3.16 (cada escritura pide `.select("id")` y falla si no afectó filas, por ejemplo cuando RLS lo bloquea). Las pantallas que ignoraban la respuesta (agenda, horarios, interruptor de servicios y "Cancelar cita") ahora muestran `components/ui/ErrorMessage.tsx` y revierten el cambio optimista.
- [ ] 3.17 **(Pospuesta: hoy hay un solo barbero.)** Construir en `DailyAppointmentsList` el selector para asignar barbero y sillón. La acción `assignAppointmentBarberAction` existe, pero ninguna pantalla la usa. Retomar cuando se sume un segundo barbero, actualizando antes la spec F3.
- [ ] 3.13 Validar el rol en el servidor dentro de cada Server Action según la columna "Rol" de `docs/contratos/api.md` (hoy solo `createExpenseAction` lo hace), en ambos modos. **Código hecho** (`requireRole` en 8 acciones; el cliente solo puede cancelar sus propias citas) y verificado que el admin sigue pudiendo cambiar datos. **Falta** comprobar con una sesión de cliente que es rechazado (se hará en 3.9 con una cuenta de prueba).
- [ ] 3.14 Renombrar `middleware.ts` a `proxy.ts` según la convención de Next.js 16 (consultar `node_modules/next/dist/docs/`) y comprobar que la protección de `/cliente` y `/admin` sigue igual.
- [x] 3.16 En modo Supabase, las lecturas (`lib/data/queries.ts`) y escrituras (`lib/actions.ts`) deben usar **solo** Supabase: no mezclar con el store en memoria ni con `lib/data/mock.ts`, y usar como id del usuario el `uuid` de Supabase (hoy `/admin` muestra 4 citas de ejemplo que no existen en la base y `/cliente` consulta citas con un id local `usr-…`, error `invalid input syntax for type uuid`).
- [x] 3.15 Con Supabase conectado, `lib/supabase/proxy.ts` debe leer el rol desde la base de datos (`get_my_role()`) y no desde `user_metadata` (editable por el usuario) ni desde la cookie demo `jm_user_session`; `/admin` solo admite `admin` y `barbero`, y `/admin/contabilidad` solo `admin`. El modo demo sigue igual.
- [ ] 3.7 Registrar la primera cuenta desde `/registro` y promoverla a administrador con `update profiles set role = 'admin'` (**hecho**: cuenta admin creada y con acceso a `/admin`); crear una cuenta `barbero` de prueba desde `/admin/usuarios` (pendiente, depende de 3.11).
- [ ] 3.8 Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel (Production y Preview), hacer push a `main` y confirmar el despliegue en estado Ready.
- [ ] 3.9 Verificar en la URL pública todos los criterios **[Back]** de F1–F5 y registrar el resultado (cumple / no cumple) en `BITACORA_IA.md`.
