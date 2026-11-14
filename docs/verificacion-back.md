# Verificación de criterios [Back] · tarea 3.9

URL: https://jm-barber-studio-delta.vercel.app · Base: Supabase "Barberia JM".
Leyenda: ✅ cumple · ❌ no cumple · ⏳ pendiente.

## Cuentas para las pruebas
| Cuenta | Dónde se usa | Rol |
|---|---|---|
| Admin (`juanramosnn7@gmail.com`) | Panel del navegador integrado | `admin` |
| Cliente de prueba A | Navegador normal (Chrome/Edge) | `cliente` → luego `barbero` |
| Cliente de prueba B | Ventana de incógnito del navegador normal | `cliente` |

## Resultados

| # | Spec | Criterio (resumen) | Cómo se prueba | Resultado |
|---|---|---|---|---|
| 1 | F1 | Registro crea usuario en Auth y perfil `cliente` | Registrar en `/registro`; revisar la base | ✅ `juanramosnn7@gmail.com` se registró en producción y quedó en Auth + `profiles` como `cliente` |
| 2 | F1 | La cuenta inicia sesión desde otro navegador | A entra en incógnito con su correo | ✅ la cuenta admin se registró en el panel del navegador integrado y el estudiante inició sesión con ella desde su Chrome normal |
| 3 | F1 | `/` carga sin errores sin sesión y con cada rol | `curl` sin sesión + visitar con admin, cliente y barbero | ⏳ (sin sesión: ✅ 200, 6 servicios) |
| 4 | F1 | Admin promovido entra a `/admin`; cookie falsa no da acceso | `curl` con `jm_user_session=user-admin` | ✅ cookie falsa → `/login`; la cuenta promovida a `admin` por SQL entró a `/admin` en producción sin volver a iniciar sesión |
| 5 | F1 | Servicio desactivado desaparece de `/` | Admin apaga un servicio en `/admin/servicios`; recargar `/` | ✅ el admin apagó "Arreglo de cejas" y la portada pública dejó de mostrarlo (5 de 6 servicios) |
| 6 | F2 | La cita sigue en "Próxima cita" desde otro navegador | A reserva; entra en incógnito | ⏳ |
| 7 | F2 | El turno de A no aparece disponible para B | B abre la misma fecha | ⏳ |
| 8 | F2 | Dos clientes al mismo turno: solo uno queda | Probado en la base (error 23505) en el paso 6 | ✅ (base) |
| 9 | F2 | Un cliente no ve citas de otro | B revisa `/cliente` | ✅ el cliente B no vio citas de otros en `/cliente` (confirmado por el estudiante; RLS probado en el paso 6) |
| 10 | F3 | La cita de A aparece en `/admin` del admin | Admin abre `/admin` el día de la cita | ✅ el barbero ve en `/admin` las 3 citas de hoy con el nombre de cada cliente |
| 11 | F3 | El cambio de estado se conserva | Admin completa la cita y recarga | ✅ las citas de hoy 09:00 y 17:00 se marcaron `completada` (pago `pagado`) a las 13:00 y siguen así en la base tras recargas y 2 despliegues |
| 12 | F4 | Cambios de horario/servicios/roles sobreviven a un despliegue | Revisar después del siguiente push | ⏳ |
| 13 | F4 | Usuario promovido a `barbero` entra a `/admin` | Admin cambia A a barbero; A vuelve a entrar | ✅ `juanramosnn17` pasó a barbero desde `/admin/usuarios` y al volver a entrar llegó a `/admin` (solo "Citas" en el menú; `/admin/usuarios` lo devuelve a `/admin`) |
| 14 | F4 | Usuario eliminado desaparece y no puede entrar | Admin elimina a B; B intenta entrar | ✅ el admin eliminó a B a las 14:08 con `delete_user`; la cuenta desapareció y su sesión recibió 403 "user_not_found" |
| 15 | F4 | Si Supabase rechaza un cambio, se ve un error | Probado en el paso 7 (borrado bloqueado por RLS) | ✅ (local) |
| 16 | F4 | Un cliente no puede ejecutar acciones de admin | B (cliente) abre `/admin/horarios` | ✅ B no pudo entrar al panel de admin; los logs no muestran cambios en horarios, servicios ni perfiles hechos por un cliente |
| 17 | F5 | Un gasto registrado se conserva | Admin registra un gasto de prueba y recarga | ✅ gasto "prueba" (otros, $1.000, fecha 30-nov) guardado en `expenses` y visible tras recargar |
| 18 | F5 | Una cita `completada` aparece como ingreso | Tras el #11, revisar el reporte del periodo | ✅ periodo "Hoy": las 2 citas completadas suman $50.000, igual que en la base |

## Hallazgos durante la verificación
- **Reserva en hora pasada:** el cliente A reservó hoy a las 09:00 cuando en Bogotá eran las 12:59. → Nuevo criterio en F2 y tarea 3.18. ✅ **Corregido:** tras el despliegue de las 13:03 no se crearon citas en el pasado, y el estudiante confirmó que la grilla de hoy oculta las horas pasadas.
- **Cierre de sesión global:** a las 12:57 un `logout` con `scope=global` cerró la sesión del admin también en el panel. → Tarea 3.19. ✅ **Corregido:** los cierres de las 13:11, 13:16 y 13:24 fueron `scope=local`, y la sesión de admin siguió activa.
- **Sin salida desde "Vista de Cliente"** (reportado por el estudiante) → criterio nuevo en F3 y tarea 3.20. ✅ **Corregido:** botón "Volver al panel", verificado por el estudiante.

Adicional (F5, sin criterio [Back]): la API `/api/accounting/profit-report` responde **401** sin sesión (JSON y CSV) ✅.
