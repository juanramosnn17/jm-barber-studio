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

## Back, Persistencia y Motor Contable (Integrado en Next.js + Supabase)
- [x] 2.1 Definir esquema SQL en `supabase/schema.sql` (tablas `profiles`, `services`, `business_hours`, `appointments`, `expenses`, políticas RLS, trigger `handle_new_user` y datos semilla).
- [x] 2.2 Implementar almacén reactivo en memoria (`lib/data/store.ts`) y gestión de sesión por cookies (`lib/auth/session.ts`) para soporte híbrido Demo + Supabase.
- [x] 2.3 Implementar clientes de Supabase (`lib/supabase/client.ts`, `server.ts`, `env.ts`) y middleware de protección de rutas por rol (`middleware.ts` y `lib/supabase/proxy.ts`).
- [x] 2.4 Implementar capa de lecturas del servidor (`lib/data/queries.ts`) y Server Actions de mutación (`lib/actions.ts`) con prevención de overbooking y `revalidatePath`.
- [x] 2.5 Implementar motor financiero (`lib/accounting/profit-report.*.ts`), endpoint de exportación CSV (`app/api/accounting/profit-report/route.ts`) y pruebas unitarias (`tests/accounting/profit-report.test.ts`).
