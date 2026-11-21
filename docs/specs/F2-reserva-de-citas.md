# F2 · Reserva de citas y área del cliente

## Historia
Como cliente autenticado, quiero ver mi próxima cita programada y contar con un asistente paso a paso para elegir servicio, fecha y hora disponible sin cruces de agenda, para asegurar mi turno en la barbería.

## Comportamiento
1. Al ingresar a `/cliente`, el cliente ve un saludo personalizado con su nombre y la tarjeta **Próxima cita** (`NextAppointmentCard`), que muestra los detalles de su reserva activa más cercana (fecha, hora de inicio y fin, y servicio, sin mostrar *"Barbero sin asignar"* ni sillón porque el estudio tiene un solo barbero) o un estado vacío invitándolo a agendar.
2. Más abajo se presenta el asistente interactivo `BookingWizard` organizado en 4 pasos:
   - **Paso 1 (Servicio):** Selección visual de uno de los servicios activos del catálogo (mostrando precio y duración).
   - **Paso 2 (Fecha):** Calendario mensual interactivo que marca si el estudio está abierto o cerrado según `business_hours.open_days`.
   - **Paso 3 (Hora):** Grilla de turnos generados cada `slot_minutes` (ej. 30 min o 15 min) entre la apertura y el cierre, mostrando únicamente las horas de inicio donde **cabe completo** el servicio elegido (`[time, time + duration_minutes)`) sin cruzar la pausa de almuerzo (`break_start` a `break_end`), el cierre, horas ya pasadas (hora Colombia) ni rangos de citas activas existentes en esa fecha.
   - **Paso 4 (Resumen y Confirmación):** Muestra el resumen del servicio, fecha, rango horario y precio total con botón para confirmar la reserva.
3. Al confirmar, el servidor valida servicio activo, horario laboral, que no sea pasado y que el rango `[time, end_time)` no se solape con ninguna otra cita no cancelada; congela `end_time` y guarda la cita con estado `confirmada` a nombre del usuario autenticado. Un cliente puede tener varias citas activas en horarios distintos; la tarjeta superior le muestra la más próxima y le permite cancelar sus citas activas.

## Criterios de aceptación
- [ ] En `/cliente`, al seleccionar otro servicio en el Paso 1 del asistente, el resumen del Paso 4 actualiza inmediatamente el nombre del servicio, su duración y el precio a pagar.
- [ ] Al seleccionar en el calendario un día configurado como cerrado (por defecto domingo), el Paso 3 no muestra turnos horarios y avisa que la barbería no atiende ese día.
- [ ] Los horarios correspondientes a la pausa de almuerzo configurada (por defecto `14:00` y `14:30`) no aparecen como seleccionables en la grilla de turnos.
- [ ] Al confirmar una reserva en una fecha y hora, ese turno desaparece de las horas disponibles para esa misma fecha y aparece reflejado en la tarjeta superior de próxima cita del cliente.
- [ ] Si se intenta reservar un bloque horario ya ocupado en la misma fecha, el sistema rechaza la creación y muestra el mensaje `"Este bloque horario ya está ocupado. Por favor elige otro turno."`.
- [ ] Al elegir la fecha de **hoy**, la grilla no muestra los turnos cuya hora ya pasó (hora de Colombia), y el servidor rechaza una reserva en una fecha u hora pasada con el mensaje `"No puedes reservar en una fecha u hora que ya pasó."`. *(Agregado tras la verificación del paso 11: hoy se puede reservar a las 9:00 AM cuando ya es mediodía.)*

### Regla de negocio para la base de datos
Dos citas no canceladas en la misma fecha **nunca pueden solaparse** en su rango horario `[time, end_time)`. Con Supabase, esta regla la hace cumplir la propia base de datos (índice único parcial sobre `(date, time)` + restricción de exclusión sin solapamiento sobre `[time, end_time)` donde `status <> 'cancelada'`); la disponibilidad se consulta con la función `get_booked_ranges(date)` que devuelve los rangos ocupados sin exponer datos de otros clientes.

### Criterios con Supabase conectado [Back]
- [ ] [Back] Una cita confirmada sigue apareciendo en la tarjeta **Próxima cita** después de cerrar sesión y volver a entrar desde otro navegador.
- [ ] [Back] Si el cliente A reserva un turno, al cliente B (otra cuenta, otro navegador) ese rango horario ya no le aparece disponible en la misma fecha.
- [ ] [Back] Si dos clientes confirman el mismo turno (o rangos solapados) casi al mismo tiempo, solo uno queda guardado y el otro ve el mensaje `"Este bloque horario ya está ocupado. Por favor elige otro turno."`.
- [ ] [Back] Un cliente no ve en `/cliente` ninguna cita de otro cliente.

## Criterios de aceptación del back
- [ ] **Dado** un cliente con sesión y un servicio activo de `60 min` en un día abierto sin cruces, **cuando** llama a `POST /api/appointments` con `time = "09:00"`, **entonces** responde `201`, guarda la cita a su nombre (`client_id = auth.uid()`) con `end_time = "10:00"` y aparece en `GET /api/appointments/mine`.
- [ ] **Dado** que ya existe una cita activa de `09:00` a `10:00`, **cuando** otro cliente intenta reservar un servicio de `30 min` a las `09:30` en la misma fecha, **entonces** responde `409` con `"Este bloque horario ya está ocupado. Por favor elige otro turno."` y no se crea nada.
- [ ] **Dado** que la pausa de almuerzo es de `14:00` a `15:00`, **cuando** un cliente intenta reservar un servicio de `60 min` a las `13:30`, **entonces** responde `400` con `"Ese horario no está disponible. Elige un turno de la lista."` (mientras que un servicio de `30 min` a las `13:30` sí responde `201`).
- [ ] **Dado** un visitante sin sesión, **cuando** llama a `POST /api/appointments` o `GET /api/appointments/mine`, **entonces** responde `401`.
- [ ] **Dado** un cliente con sesión, **cuando** intenta reservar en una fecha u hora que ya pasó (hora `America/Bogota`) o con un servicio inactivo, **entonces** responde `400` (pasado) o `404` (servicio no disponible) sin crear la cita.
- [ ] **Dado** un cliente A con sesión, **cuando** intenta cancelar una cita perteneciente al cliente B mediante `PATCH /api/appointments/:id/status`, **entonces** responde `404` y la cita de B permanece activa.

## Fuera de alcance
Pago en línea de la cita o selección manual del barbero por parte del cliente durante la reserva.
