# F4 · Administración de servicios, horarios y usuarios

## Historia
Como administrador del estudio, quiero gestionar el catálogo de servicios, configurar los días y horas de atención de la barbería y administrar los usuarios registrados y sus roles, viendo los cambios reflejados de inmediato en toda la aplicación.

## Comportamiento
1. **Horarios (`/admin/horarios`):** El componente `ScheduleConfig` permite activar o desactivar los días de apertura (lunes a domingo), definir hora de apertura (`open_time`), hora de cierre (`close_time`), inicio y fin de pausa de almuerzo (`break_start`, `break_end`) y el paso de inicio de turnos (`slot_minutes`, ej. `15`, `30`, `45` o `60` min). Al guardar, el asistente de reservas en `/cliente` recalcula los turnos de inmediato.
2. **Servicios (`/admin/servicios`):** El componente `ServicesManager` lista todos los servicios del catálogo con un interruptor para activarlos o desactivarlos, un formulario para crear un nuevo servicio y la opción de **editar servicios existentes** (nombre, precio, duración en minutos, reserva fija, descripción, qué incluye e imagen). Editar precio, duración o reserva solo aplica a reservas/cobros futuros; el historial ya guardado se conserva intacto.
3. **Usuarios (`/admin/usuarios`):** El componente `UsersTable` muestra la tabla paginada de usuarios registrados (sin buscador ni filtro por rol), permitiendo editar sus datos y rol (`cliente`, `barbero`, `admin`) o eliminarlos. Al eliminar un usuario, sus citas futuras activas se cancelan para liberar los turnos y sus citas históricas se conservan con `client_id = NULL` (*"Cliente eliminado"*) para no descuadrar la contabilidad.

### Permisos por rol
| Sección | admin | barbero |
|---|---|---|
| `/admin` (agenda y estados de citas) | ✅ | ✅ |
| `/admin/servicios`, `/admin/horarios`, `/admin/usuarios` | ✅ | ❌ no aparecen en su menú; si entra por la URL vuelve a `/admin` |
| `/admin/contabilidad/ganancias` | ✅ | ❌ |
| Datos de clientes | todos | solo **nombre y apellido** de los clientes en la agenda (sin correo ni teléfono) |

## Criterios de aceptación
- [ ] Un usuario `barbero` no ve "Servicios", "Horarios", "Usuarios" ni "Contabilidad" en el menú lateral, y si abre esas URLs es redirigido a `/admin`.
- [ ] Un usuario `barbero` ve en la agenda de `/admin` el nombre de cada cliente, pero no puede consultar su correo ni su teléfono.
- [ ] En `/admin/horarios`, al desactivar un día de la semana o modificar la hora de apertura/cierre y guardar, el calendario y los turnos ofrecidos en `/cliente` reflejan el nuevo horario inmediatamente.
- [ ] En `/admin/servicios`, al desactivar un servicio con su interruptor, dicho servicio deja de mostrarse en la portada pública (`/`) y en el selector de reservas de `/cliente`.
- [ ] En `/admin/servicios`, al crear un servicio nuevo con nombre y precio válido, este aparece en el listado administrativo y queda disponible para reservar en `/cliente`.
- [ ] En `/admin/usuarios`, al editar el rol de un usuario (por ejemplo de `cliente` a `barbero`) y guardar, la etiqueta de rol en la tabla se actualiza inmediatamente.

### Criterios con Supabase conectado [Back]
- [ ] [Back] Los cambios de horario, servicios y roles se conservan después de un nuevo despliegue en Vercel (no se pierden como en el modo demo).
- [ ] [Back] Un usuario promovido a `barbero` en `/admin/usuarios` entra a `/admin` en su siguiente inicio de sesión.
- [ ] [Back] Al eliminar un usuario en `/admin/usuarios`, desaparece de la tabla tras recargar y ya no puede iniciar sesión con su correo.
- [ ] [Back] Si Supabase rechaza un cambio (por ejemplo, sin conexión), la pantalla muestra un mensaje de error y no aparece el cambio como guardado.
- [ ] [Back] Un usuario `cliente` que llame una acción de administración (por ejemplo, cambiar el horario) recibe un rechazo y el horario no cambia.

## Criterios de aceptación del back
- [ ] **Dado** el `admin` autenticado, **cuando** edita un servicio existente (`PUT /api/services/:id` cambiando `duration_minutes` o `price`) o su reserva (`PATCH /api/services/:id/reserve`), **entonces** responde `200`, los cambios aplican a nuevas reservas/cobros y las citas previas conservan su `end_time`, `gross_amount` y `reserve_amount` congelados.
- [ ] **Dado** el `admin` autenticado, **cuando** envía un servicio con `reserve_amount > price`, `price <= 0` o `duration_minutes <= 0`, **entonces** responde `400` y no guarda el cambio.
- [ ] **Dado** el `admin` autenticado, **cuando** actualiza `PUT /api/business-hours` con `close_time <= open_time` o pausa de almuerzo fuera del horario, **entonces** responde `400`; **cuando** envía un horario válido (incluyendo un nuevo `slot_minutes`), responde `200`.
- [ ] **Dado** un `cliente` o `barbero` autenticado, **cuando** llama a `POST /api/services`, `PUT /api/business-hours`, `GET /api/users` o `DELETE /api/users/:id`, **entonces** responde `403` con `"No tienes permisos para realizar esta acción."`.
- [ ] **Dado** el `admin` autenticado, **cuando** intenta eliminarse a sí mismo (`DELETE /api/users/:id`) o quitarse el rol `admin` (`PUT /api/users/:id`), **entonces** responde `409` y la cuenta sigue intacta como `admin`.
- [ ] **Dado** el `admin` autenticado y un cliente con 1 cita completada histórica y 1 cita futura confirmada, **cuando** llama a `DELETE /api/users/:id`, **entonces** responde `204`, la cita futura queda `cancelada` (liberando el turno), la cita completada se conserva con `client_id = NULL` (contabilidad intacta) y el usuario ya no puede iniciar sesión.

## Fuera de alcance
Eliminación física de servicios que ya tienen citas históricas asociadas (se usa desactivación lógica con `is_active`).
