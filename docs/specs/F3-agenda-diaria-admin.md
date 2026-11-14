# F3 · Gestión operativa de agenda diaria (Admin y Barbero)

## Historia
Como administrador o barbero del estudio, quiero visualizar todas las citas del día con indicadores clave, filtrar por estado, asignar qué barbero y sillón atenderán cada turno y actualizar el estado de la cita (`confirmada`, `completada`, `cancelada`).

## Comportamiento
1. En `/admin`, el panel muestra en la parte superior 4 tarjetas KPI del día actual: **Citas Totales**, **Confirmadas**, **Pendientes** y **Completadas**.
2. Debajo, el componente `DailyAppointmentsList` lista las citas de la jornada ordenadas cronológicamente por hora (`HH:MM`), permitiendo filtrarlas por estado (`Todas`, `Confirmadas`, `Pendientes`, `Completadas`) o buscar por nombre de cliente/servicio.
3. Desde cada tarjeta de cita, el administrador o barbero puede abrir el selector de asignación para definir el **nombre del barbero** y el **sillón** (ej. `Sillón 01`) mediante `assignAppointmentBarberAction`.
4. Cada cita dispone de acciones rápidas para cambiar su estado (`updateAppointmentStatusAction`): aprobar (`confirmada`), marcar como terminada (`completada`) o rechazar/anular (`cancelada`). Al marcarse como `completada`, el sistema registra automáticamente su pago en efectivo (`payment_status = 'pagado'`) para el reporte contable.

## Criterios de aceptación
- [ ] En `/admin` se muestran los 4 contadores superiores (Citas Totales, Confirmadas, Pendientes y Completadas) coincidiendo exactamente con las citas listadas en la jornada.
- [ ] Al asignar o cambiar el barbero y el sillón en una cita y guardar, la fila de la cita muestra inmediatamente el nuevo nombre de barbero y el sillón asignado.
- [ ] Al cambiar el estado de una cita a `completada`, el contador de "Completadas" sube en 1 y la etiqueta de estado de esa cita cambia a completada.
- [ ] Al cancelar una cita desde el panel administrativo, el bloque horario de esa cita vuelve a quedar disponible para nuevas reservas en `/cliente`.

## Fuera de alcance
Reprogramación arrastrando y soltando (drag & drop) en calendario semanal.
