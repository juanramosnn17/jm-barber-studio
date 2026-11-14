# F2 · Reserva de citas y área del cliente

## Historia
Como cliente autenticado, quiero ver mi próxima cita programada y contar con un asistente paso a paso para elegir servicio, fecha y hora disponible sin cruces de agenda, para asegurar mi turno en la barbería.

## Comportamiento
1. Al ingresar a `/cliente`, el cliente ve un saludo personalizado con su nombre y la tarjeta **Próxima cita** (`NextAppointmentCard`), que muestra los detalles de su reserva activa más cercana (fecha, hora, servicio, barbero asignado y sillón) o un estado vacío invitándolo a agendar.
2. Más abajo se presenta el asistente interactivo `BookingWizard` organizado en 4 pasos:
   - **Paso 1 (Servicio):** Selección visual de uno de los servicios activos del catálogo.
   - **Paso 2 (Fecha):** Calendario mensual interactivo que marca si el estudio está abierto o cerrado según `business_hours.open_days`.
   - **Paso 3 (Hora):** Grilla de turnos generados cada `slot_minutes` (ej. 30 min) entre la apertura y el cierre, excluyendo la franja de almuerzo (`break_start` a `break_end`) y excluyendo los turnos que ya tienen citas activas en esa fecha.
   - **Paso 4 (Resumen y Confirmación):** Muestra el resumen del servicio, fecha, hora y precio total con botón para confirmar la reserva.
3. Al confirmar, `createAppointmentAction` verifica que el bloque horario no esté ocupado, guarda la cita con estado `confirmada` y muestra la tarjeta de confirmación en pantalla actualizando la tarjeta de próxima cita.

## Criterios de aceptación
- [ ] En `/cliente`, al seleccionar otro servicio en el Paso 1 del asistente, el resumen del Paso 4 actualiza inmediatamente el nombre del servicio, su duración y el precio a pagar.
- [ ] Al seleccionar en el calendario un día configurado como cerrado (por defecto domingo), el Paso 3 no muestra turnos horarios y avisa que la barbería no atiende ese día.
- [ ] Los horarios correspondientes a la pausa de almuerzo configurada (por defecto `14:00` y `14:30`) no aparecen como seleccionables en la grilla de turnos.
- [ ] Al confirmar una reserva en una fecha y hora, ese turno desaparece de las horas disponibles para esa misma fecha y aparece reflejado en la tarjeta superior de próxima cita del cliente.
- [ ] Si se intenta reservar un bloque horario ya ocupado en la misma fecha, el sistema rechaza la creación y muestra el mensaje `"Este bloque horario ya está ocupado. Por favor elige otro turno."`.

## Fuera de alcance
Pago en línea de la cita o selección manual del barbero por parte del cliente durante la reserva.
