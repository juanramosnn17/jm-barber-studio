# F3 · Gestión operativa de agenda diaria (Admin y Barbero)

## Historia
Como administrador o barbero del estudio, quiero visualizar todas las citas del día con indicadores clave, filtrar por estado y actualizar el estado de la cita (`confirmada`, `completada`, `cancelada`).

> **Contexto actual:** el estudio tiene **un solo barbero**, así que en el MVP no se asigna barbero ni sillón por cita (ver "Fuera de alcance").

## Comportamiento
1. En `/admin`, el panel muestra en la parte superior 4 tarjetas KPI del día actual: **Citas Totales**, **Confirmadas**, **Pendientes** y **Completadas**.
2. Debajo, el componente `DailyAppointmentsList` lista las citas de la jornada ordenadas cronológicamente por hora (`HH:MM`), permitiendo filtrarlas por estado (`Todas`, `Confirmadas`, `Pendientes`, `Completadas`) o buscar por nombre de cliente/servicio.
3. Cada cita dispone de acciones rápidas para cambiar su estado (`updateAppointmentStatusAction`): aprobar (`confirmada`), marcar como terminada (`completada`) o rechazar/anular (`cancelada`). Al marcarse como `completada`, el sistema registra automáticamente su pago en efectivo (`payment_status = 'pagado'`) para el reporte contable.

## Criterios de aceptación
- [ ] En `/admin` se muestran los 4 contadores superiores (Citas Totales, Confirmadas, Pendientes y Completadas) coincidiendo exactamente con las citas listadas en la jornada.
- [ ] Al cambiar el estado de una cita a `completada`, el contador de "Completadas" sube en 1 y la etiqueta de estado de esa cita cambia a completada.
- [ ] Al cancelar una cita desde el panel administrativo, el bloque horario de esa cita vuelve a quedar disponible para nuevas reservas en `/cliente`.

### Criterios con Supabase conectado [Back]
- [ ] [Back] Una cita reservada por un cliente aparece en `/admin` al iniciar sesión como admin o barbero en otro navegador.
- [ ] [Back] El cambio de estado se conserva al recargar la página y al entrar desde otro dispositivo.

## Fuera de alcance
- Reprogramación arrastrando y soltando (drag & drop) en calendario semanal.
- **Asignar barbero y sillón por cita** (pospuesto mientras haya un solo barbero). La acción `assignAppointmentBarberAction` y las columnas `barber_name` / `chair` ya existen, así que se puede retomar con la tarea 3.17 cuando se sume un segundo barbero.
