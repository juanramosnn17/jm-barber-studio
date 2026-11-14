# F4 · Administración de servicios, horarios y usuarios

## Historia
Como administrador del estudio, quiero gestionar el catálogo de servicios, configurar los días y horas de atención de la barbería y administrar los usuarios registrados y sus roles, viendo los cambios reflejados de inmediato en toda la aplicación.

## Comportamiento
1. **Horarios (`/admin/horarios`):** El componente `ScheduleConfig` permite activar o desactivar los días de apertura (lunes a domingo), definir hora de apertura (`open_time`), hora de cierre (`close_time`), inicio y fin de pausa de almuerzo (`break_start`, `break_end`), duración de bloque en minutos (`slot_minutes`) y cantidad de barberos (`barbers_count`). Al guardar con `updateBusinessHoursAction`, el asistente de reservas en `/cliente` recalcula los turnos de inmediato.
2. **Servicios (`/admin/servicios`):** El componente `ServicesManager` lista todos los servicios del catálogo con un interruptor para activarlos o desactivarlos (`toggleServiceActiveAction`) y un formulario para crear un nuevo servicio (`createServiceAction`) con nombre, nombre corto, precio, duración, descripción, qué incluye e imagen.
3. **Usuarios (`/admin/usuarios`):** El componente `UsersTable` muestra la tabla paginada de usuarios registrados con filtro por rol y buscador, permitiendo editar sus datos y rol (`cliente`, `barbero`, `admin`) mediante `updateUserAction` o eliminarlos con `deleteUserAction`.

## Criterios de aceptación
- [ ] En `/admin/horarios`, al desactivar un día de la semana o modificar la hora de apertura/cierre y guardar, el calendario y los turnos ofrecidos en `/cliente` reflejan el nuevo horario inmediatamente.
- [ ] En `/admin/servicios`, al desactivar un servicio con su interruptor, dicho servicio deja de mostrarse en la portada pública (`/`) y en el selector de reservas de `/cliente`.
- [ ] En `/admin/servicios`, al crear un servicio nuevo con nombre y precio válido, este aparece en el listado administrativo y queda disponible para reservar en `/cliente`.
- [ ] En `/admin/usuarios`, al editar el rol de un usuario (por ejemplo de `cliente` a `barbero`) y guardar, la etiqueta de rol en la tabla se actualiza inmediatamente.

### Criterios con Supabase conectado [Back]
- [ ] [Back] Los cambios de horario, servicios y roles se conservan después de un nuevo despliegue en Vercel (no se pierden como en el modo demo).
- [ ] [Back] Un usuario promovido a `barbero` en `/admin/usuarios` entra a `/admin` en su siguiente inicio de sesión.

## Fuera de alcance
Eliminación física de servicios que ya tienen citas históricas asociadas (se usa desactivación lógica con `is_active`).
