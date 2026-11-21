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
- [x] 2.3 Implementar clientes de Supabase (`server.ts`, `env.ts` (el cliente de navegador `client.ts` se eliminó por no usarse)) y middleware de protección de rutas por rol (`middleware.ts` y `lib/supabase/proxy.ts`).
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
- [x] 3.11 Agregar políticas para que el admin pueda **editar** cualquier perfil y una función `delete_user(id)` (`security definer`, solo admin) que borre el usuario de `auth.users` (y en cascada su perfil); ajustar `deleteUserAction` para usarla.
- [x] 3.12 En cada mutación de `lib/actions.ts`, revisar el `error` que devuelve Supabase: si falla, responder `{ ok: false, message }` y no confirmar el cambio en el store en memoria. Hecho junto con 3.16 (cada escritura pide `.select("id")` y falla si no afectó filas, por ejemplo cuando RLS lo bloquea). Las pantallas que ignoraban la respuesta (agenda, horarios, interruptor de servicios y "Cancelar cita") ahora muestran `components/ui/ErrorMessage.tsx` y revierten el cambio optimista.
- [x] 3.17 **(Descartada para el MVP por decisión del estudiante: hay un solo barbero.)** Construir en `DailyAppointmentsList` el selector para asignar barbero y sillón. La acción `assignAppointmentBarberAction` existe, pero ninguna pantalla la usa. Retomar cuando se sume un segundo barbero, actualizando antes la spec F3.
- [x] 3.13 Validar el rol en el servidor dentro de cada Server Action según la columna "Rol" de `docs/contratos/api.md` (hoy solo `createExpenseAction` lo hace), en ambos modos. **Código hecho** (`requireRole` en 8 acciones; el cliente solo puede cancelar sus propias citas) y verificado que el admin sigue pudiendo cambiar datos. Rechazo del cliente verificado en 3.9 (criterio 16).
- [x] 3.14 Renombrar `middleware.ts` a `proxy.ts` según la convención de Next.js 16 (consultar `node_modules/next/dist/docs/`) y comprobar que la protección de `/cliente` y `/admin` sigue igual.
- [x] 3.16 En modo Supabase, las lecturas (`lib/data/queries.ts`) y escrituras (`lib/actions.ts`) deben usar **solo** Supabase: no mezclar con el store en memoria ni con `lib/data/mock.ts`, y usar como id del usuario el `uuid` de Supabase (hoy `/admin` muestra 4 citas de ejemplo que no existen en la base y `/cliente` consulta citas con un id local `usr-…`, error `invalid input syntax for type uuid`).
- [x] 3.15 Con Supabase conectado, `lib/supabase/proxy.ts` debe leer el rol desde la base de datos (`get_my_role()`) y no desde `user_metadata` (editable por el usuario) ni desde la cookie demo `jm_user_session`; `/admin` solo admite `admin` y `barbero`, y `/admin/contabilidad` solo `admin`. El modo demo sigue igual.
- [x] 3.7 Registrar la primera cuenta desde `/registro` y promoverla a administrador con `update profiles set role = 'admin'` (**hecho**: cuenta admin creada y con acceso a `/admin`); cuenta `barbero` de prueba (`juanramosnn17`) creada desde `/admin/usuarios` y verificada.
- [x] 3.8 Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel (Production y Preview), hacer push a `main` y confirmar el despliegue en estado Ready.
- [x] 3.9 Verificar en la URL pública todos los criterios **[Back]** de F1–F5 y registrar el resultado (cumple / no cumple) en `BITACORA_IA.md`. Hoja de seguimiento: `docs/verificacion-back.md`. **Resultado: 18 de 18 criterios cumplen** (14-nov-2026).
- [x] 3.18 *(Encontrada en 3.9.)* No permitir reservar turnos que ya pasaron: ocultarlos en la grilla de hoy (`lib/schedule.ts` / `BookingWizard`) y rechazarlos en `createAppointmentAction`, usando la hora de Colombia (`America/Bogota`). Nuevo criterio en la spec F2.
- [x] 3.19 *(Encontrada en 3.9.)* `logoutAction` debe cerrar sesión solo en el dispositivo actual (`signOut({ scope: "local" })`). Hoy usa el alcance global de Supabase y cerrar sesión en un navegador saca a esa cuenta de todos los demás.
- [x] 3.20 *(Reportada por el estudiante.)* En "Vista de Cliente", el admin o barbero no tenía cómo volver a `/admin`. `AppHeader` ahora muestra "Volver al panel" y "Panel Principal" apunta a `/admin` según el rol real del usuario (criterio nuevo en F3). Verificado en producción por el estudiante.
- [x] 3.21 Permisos del barbero (spec F4, "Permisos por rol") — verificado en producción con `juanramosnn17` como barbero: ocultar Servicios/Horarios/Usuarios en `AdminSidebar`, redirigir esas rutas a `/admin` en `proxy.ts`, quitar al barbero de la política de lectura de `profiles` y darle solo nombre y apellido de clientes con `get_client_names(ids)`.
- [x] 3.22 *(Pedida por el estudiante.)* Quitar el botón "Panel Administrativo" de la portada y mostrar "Panel Principal" del menú de perfil solo a `admin` y `barbero` (2 criterios nuevos en F1). Verificado en producción: la portada no tiene el botón (curl) y el estudiante confirmó que un cliente no ve "Panel Principal".
- [ ] 3.23 *(Pedida por el estudiante.)* Anular gastos con motivo obligatorio: columnas `void_reason` y `voided_at` en `expenses`, `voidExpenseAction` y botón en el comprobante (spec F5).
- [ ] 3.24 *(Pedida por el estudiante.)* Editar gastos registrados: `updateExpenseAction` y formulario en el comprobante (spec F5).
- [ ] 3.25 *(Pedida por el estudiante.)* Eliminar gastos con confirmación: `deleteExpenseAction` y botón en el comprobante (spec F5).
- [ ] 3.26 *(Pedida por el estudiante.)* Ajustar el pago de una cita completada (método, descuento, reembolso): `adjustAppointmentPaymentAction` y formulario en el comprobante (spec F5).

## Contabilidad para la barbería (rediseño pedido por el estudiante)
> Orden: 3.27 → 3.28 → 3.29 → 3.30 → 3.31. Spec: `docs/specs/F5-contabilidad-y-ganancias.md` → "Modelo contable de la barbería".
- [ ] 3.27 Reserva fija por servicio sin comisión: columna `services.reserve_amount` (editable en `/admin/servicios`), `appointments.reserve_amount` fijada al completar, y motor contable con Ingresos · Reserva · Tu ganancia · Gastos · Saldo de la reserva. **Código y base hechos; falta verificar en producción.**
- [x] 3.28 Simplificar pantallas de contabilidad: 5 tarjetas, sin "barbero" ni márgenes %, periodos reducidos y tabla de 6 columnas con fila clicable. Verificado por el estudiante en producción (y ajustado a su pedido: sin encabezado, sin perfil en el menú, movimientos solo con dinero real).
- [ ] 3.29 Categoría "Compra de insumos / productos" en gastos y propinas por cita (aparte de los ingresos).
- [ ] 3.30 Venta de productos: nueva tabla `product_sales` con registrar, anular y eliminar; suma a Ingresos. *(Backend Spring Boot listo y probado el 2026-11-20: migración V2, `/product-sales` y reporte. Falta la pantalla, en la 4.9, y verificarla en el navegador, en la 4.10.)*
- [ ] 3.31 Cierre de caja del día por método de pago y efectivo esperado en caja.

## Back · Spring Boot + MySQL (Unidad 4)
> El curso exige el backend en **Spring Boot**. Reemplaza a Supabase con las mismas reglas (specs F1–F5). Contrato: `docs/contratos/api-rest.md`. Código en `backend/`. Una tarea a la vez: cada una se prueba (pruebas automáticas + navegador/Postman) antes de pasar a la siguiente.

- [x] 4.1 Crear el proyecto Spring Boot 4.2 (Java 21, Maven Wrapper) en `backend/` con Web, Validation, Data JPA, Security, MySQL y Flyway. Arranca en `http://localhost:8080` y responde `GET /api/v1/health`. Hecho: Spring Boot 4.2.0 (Initializr ya no ofrece la 3.x). `GET /api/v1/health` → 200; otra ruta sin token → 401; 3 pruebas JUnit pasan; verificado en el navegador.
- [x] 4.2 Base MySQL local `jm_barber` con usuario propio; credenciales solo en variables de entorno (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`), nunca en el código. Migración Flyway `V1` con las tablas `users`, `services`, `business_hours`, `appointments` (columna `active_slot` única) y `expenses`, más datos semilla (6 servicios y horario). Hecho: bases `jm_barber` y `jm_barber_test` y usuario `jm_app` (script `backend/scripts/setup-mysql-local.ps1`); credenciales en `backend/.env` (ignorado por git). Flyway aplicó V1: 5 tablas, horario y 6 servicios. 7 pruebas pasan (incluye turno único y reserva ≤ precio).
- [x] 4.3 Autenticación: registro (rol siempre CLIENTE), login con BCrypt y JWT, `GET /auth/me`, y Spring Security con roles. Pruebas: credenciales incorrectas → 401; cliente en endpoint de admin → 403. Hecho con Spring Security OAuth2 Resource Server (HS256, sin librerías externas): 15 pruebas pasan y en vivo registro 201, login malo 401, `/auth/me` 200 con token y 401 sin token.
- [x] 4.4 Servicios y horario: `GET/POST /services`, activar/desactivar, reserva por servicio, `GET/PUT /business-hours`.
- [x] 4.5 Citas: horas ocupadas, reservar (rechaza el pasado y el turno ocupado con 409), próxima cita, agenda del día, cambio de estado con permisos por rol y fijación de la reserva al completar.
- [x] 4.6 Usuarios (admin): listado paginado, editar datos y rol, eliminar; el admin no puede eliminarse ni quitarse el rol.
- [x] 4.7 Gastos: registrar, editar, anular con motivo y eliminar; ajuste de pago de citas (método, descuento, reembolso, propina).
- [x] 4.8 Contabilidad: reporte con el modelo de reserva (Ingresos · Tu ganancia · Reserva · Gastos · Saldo) y exportación CSV saneada.
- [ ] 4.9 Conectar Next.js: cliente HTTP en `lib/api/`, las Server Actions y consultas llaman a la API, token JWT en cookie `httpOnly`, y `proxy.ts` valida la sesión con `GET /auth/me`. El modo demo (store en memoria) se mantiene cuando `API_URL` no está definida.
- [ ] 4.10 Verificar en el navegador todos los criterios de F1–F5 contra el backend Spring Boot y registrar el resultado en `docs/verificacion-springboot.md`.
- [ ] 4.11 Retirar Supabase del frontend (dependencias, variables y archivos `lib/supabase/*`) cuando 4.10 esté completa. El despliegue del backend en AWS queda para la Unidad 6.
