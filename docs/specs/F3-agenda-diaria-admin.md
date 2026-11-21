# F3 · Gestión operativa de agenda diaria (Admin y Barbero)

## Historia
Como administrador o barbero del estudio, quiero visualizar todas las citas del día con indicadores clave, filtrar por estado y actualizar el estado de la cita (`confirmada`, `completada`, `cancelada`).

> **Contexto actual:** el estudio tiene **un solo barbero**, así que en el MVP no se asigna barbero ni sillón por cita (ver "Fuera de alcance").

## Comportamiento
1. En `/admin`, el panel muestra en la parte superior 4 tarjetas KPI del día actual: **Citas Totales**, **Confirmadas**, **Pendientes** y **Completadas**.
2. Debajo, el componente `DailyAppointmentsList` lista las citas de la jornada ordenadas cronológicamente por hora (`HH:MM`), permitiendo filtrarlas por estado (`Todas`, `Confirmadas`, `Pendientes`, `Completadas`). No hay buscador: con un solo barbero la agenda del día es corta.
3. Cada cita dispone de acciones rápidas para cambiar su estado (`updateAppointmentStatusAction`): aprobar (`confirmada`), marcar como terminada (`completada`) o rechazar/anular (`cancelada`). Una cita `pendiente` muestra "Aprobar" y "Rechazar"; una `confirmada` muestra "Completar" y "Cancelar", que pide confirmación y libera el turno (tarea 4.14). Al marcarse como `completada`, el sistema registra automáticamente su pago en efectivo (`payment_status = 'pagado'`) para el reporte contable.

## Criterios de aceptación
- [ ] En `/admin` se muestran los 4 contadores superiores (Citas Totales, Confirmadas, Pendientes y Completadas) coincidiendo exactamente con las citas listadas en la jornada.
- [ ] Al cambiar el estado de una cita a `completada`, el contador de "Completadas" sube en 1 y la etiqueta de estado de esa cita cambia a completada.
- [ ] Al cancelar una cita desde el panel administrativo, el bloque horario de esa cita vuelve a quedar disponible para nuevas reservas en `/cliente`.
- [ ] Un `admin` o `barbero` que entra a "Vista de Cliente" (`/cliente`) ve en el encabezado un botón **"Volver al panel"** que lo lleva a `/admin`, y la opción "Panel Principal" de su menú también apunta a `/admin`. *(Agregado tras reporte del estudiante: desde la vista de cliente no había cómo regresar.)*

### Criterios con Supabase conectado [Back]
- [ ] [Back] Una cita reservada por un cliente aparece en `/admin` al iniciar sesión como admin o barbero en otro navegador.
- [ ] [Back] El cambio de estado se conserva al recargar la página y al entrar desde otro dispositivo.

## Criterios de aceptación del back
- [ ] **Dado** un `admin` o `barbero` autenticado, **cuando** llama a `GET /api/appointments?date=YYYY-MM-DD`, **entonces** responde `200` con las citas no canceladas de esa fecha ordenadas por `time` (con rango `time`–`end_time`); para el `barbero`, solo se incluye nombre y apellido del cliente (nunca correo ni teléfono).
- [ ] **Dado** un `cliente` autenticado, **cuando** llama a `GET /api/appointments?date=YYYY-MM-DD`, **entonces** responde `403` con `"No tienes permisos para realizar esta acción."`.
- [ ] **Dado** una cita `confirmada`, **cuando** un `admin` o `barbero` llama a `PATCH /api/appointments/:id/status` con `{ "status": "completada" }`, **entonces** responde `200`, congela `gross_amount` y `reserve_amount` del servicio en ese momento y fija `payment_status = "pagado"` y `payment_method = "efectivo"`.
- [ ] **Dado** una cita ya `completada`, **cuando** un `barbero` intenta cambiar su estado vía `PATCH /api/appointments/:id/status`, **entonces** responde `403` y el cobro no se altera (solo el `admin` puede revertir una cita completada).
- [ ] **Dado** una cita `cancelada` cuyo rango horario ya fue tomado por otro cliente, **cuando** el `admin` intenta reactivarla a `confirmada`, **entonces** responde `409` con `"Este bloque horario ya está ocupado. Por favor elige otro turno."`.
- [ ] **Dado** un `cliente` A autenticado, **cuando** intenta cancelar una cita perteneciente al cliente B (o intenta marcar una cita propia como `completada`), **entonces** responde `403` (si es ajena; con Supabase era `404` por RLS) o `403` (si pide un estado distinto de `cancelada`), sin modificar la cita.

## Fuera de alcance
- Reprogramación arrastrando y soltando (drag & drop) en calendario semanal.
- **Asignar barbero y sillón por cita** (pospuesto mientras haya un solo barbero). Las columnas `barber_name` / `chair` se conservan en la base; la acción del servidor se eliminó (código sin pantalla) y habría que crearla de nuevo si se suma un segundo barbero.
