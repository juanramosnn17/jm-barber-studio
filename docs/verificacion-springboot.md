# Verificación de F1–F5 contra el backend Spring Boot · tarea 4.10

- **Fecha:** 2026-11-21.
- **Entorno:** Next.js 16 en `http://localhost:3000` con `API_URL=http://localhost:8080`, API Spring Boot 4.2 y MySQL `jm_barber`, con las migraciones V1, V2 y V3 aplicadas.
- **Leyenda:** ✅ cumple · ⚠️ cumple con una diferencia u observación · ❌ no cumple · ➖ reemplazado por una spec posterior.

## Cómo se probó
| Frente | Cómo | Resultado |
|---|---|---|
| **Criterios del back** (Dado / Cuando / Entonces) | Script en vivo contra la API, **por fuera del formulario** (como pide la guía U4). Usó cuentas temporales `vivo-*-410@example.com` de los cuatro tipos: admin promovido con `promote-admin.ps1`, barbero, cliente A y cliente B. | **43 de 43** verificaciones OK |
| **Criterios de pantalla** | Navegador integrado, con sesión de barbero, de cliente y de admin. Las pruebas de "otro navegador" se hicieron con una sesión distinta (otro token) desde el script. | Ver tablas |
| **Pruebas automáticas** | `./mvnw test` (MockMvc + MySQL de pruebas). | 85 de 85 |

Al terminar se borraron todos los datos de prueba: 0 usuarios, 0 citas, 0 gastos y 0 ventas. El catálogo y el horario quedaron como estaban (6 servicios activos, reserva $0, lunes a sábado de 9:00 a 20:00, turnos de 30 min).

## F1 · Catálogo y autenticación
| # | Criterio (resumen) | Cómo | Resultado |
|---|---|---|---|
| UI1 | `/` muestra solo servicios activos, con precio en COP | Navegador sin sesión | ⚠️ 6 servicios con "$ 25.000", etc. **Observación:** la portada muestra como máximo 6 servicios (`slice(0, 6)`); un séptimo activo no aparece en `/`, aunque sí se puede reservar en `/cliente`. |
| UI2 | `/cliente` y `/admin` sin sesión → `/login?return_url=` | Navegador | ✅ |
| UI3 | Credenciales incorrectas → recuadro con el mensaje, sin recargar | Navegador | ⚠️ Mensaje exacto y sin recarga. **Observación:** el correo escrito se borra tras el error (React 19 reinicia el formulario). |
| UI4 | Contraseñas distintas → "Las contraseñas no coinciden." y no crea el usuario | Navegador + consulta a MySQL | ✅ |
| UI5 | Cliente que abre `/admin` → `/cliente` | Navegador | ✅ también `/admin/contabilidad/ganancias` → `/cliente` |
| UI6 | La portada no tiene botones al panel | Navegador | ✅ 0 enlaces a `/admin` |
| UI7 | "Panel Principal" solo para admin y barbero | Menú del perfil | ✅ cliente: solo "Cerrar sesión"; barbero: "Panel Principal" → `/admin` |
| Back 23–24 | Registro crea la cuenta como cliente; inicia sesión desde otra sesión | Script | ✅ |
| Back 25 | Catálogo sin errores con y sin sesión | Navegador | ✅ |
| Back 26 | Usuario promovido a admin entra; una cookie falsa no da acceso | Script + `curl` | ✅ el mismo token sirve tras promover; `jm_user_session=user-admin` y un `jm_api_token` falso → 307 a `/login` |
| Back 27 | Servicio desactivado deja de aparecer en `/` | Script + navegador | ✅ |
| B1–B6 | Contrato de servicios, registro, 409 por correo repetido, 401 en login y en `/auth/me` | Script | ✅ (6 de 6) |

## F2 · Reserva de citas
| # | Criterio (resumen) | Cómo | Resultado |
|---|---|---|---|
| UI1 | Cambiar el servicio actualiza el resumen (nombre, duración y precio) | Navegador | ⚠️ Cambian el nombre y el precio; **el resumen del paso 4 no muestra la duración** (solo se ve en la tarjeta del servicio). |
| UI2 | Día cerrado sin turnos y con aviso | Navegador (domingo 22) | ✅ "El estudio se encuentra cerrado…" |
| UI3 | El descanso no se ofrece | Navegador | ✅ 14:00 y 14:30 no aparecen; con duración real, 13:30 tampoco si el servicio no cabe |
| UI4 | Al reservar, el turno desaparece y aparece en Próxima cita | Navegador (4.12) | ✅ incluye el rango "12:30 PM – 02:00 PM" |
| UI5 | Turno ocupado → mensaje "Este bloque horario ya está ocupado…" | Script (la pantalla ya no ofrece turnos ocupados) | ✅ 409 con el mensaje |
| UI6 | Hoy no se ofrecen horas pasadas; el servidor rechaza el pasado | Script + código | ⚠️ El servidor responde 400 con el mensaje. La parte de la pantalla no se pudo observar en vivo: era antes de la apertura (7 a. m.). La cubre `isPastSlot` en `generateDailySlots`. |
| Back 27 | La cita sigue en Próxima cita desde otra sesión | Script | ✅ |
| Back 28 | El rango de A no está disponible para B, sin datos de A | Script | ✅ `booked-ranges` sin nombres ni ids |
| Back 29 | Reservas simultáneas: solo una se guarda | Script (2 reservas en paralelo) | ✅ 201 y 409 |
| Back 30 | Un cliente no ve citas de otro | Script | ✅ |
| B1 | 60 min a las 09:00 → 201, `end 10:00` | Script | ✅ |
| B2 | 30 min a las 09:30 sobre 09:00–10:00 → 409 | Script | ✅ |
| B3 | 60 min a las 13:30 → 400; 30 min → 201 | Script | ✅ |
| B4 | Sin sesión → 401 | Script | ✅ |
| B5 | Pasado → 400; servicio no disponible → 404 | Script | ⚠️ Pasado: 400 ✅. Servicio **inactivo → 400** "Este servicio no está disponible." e **inexistente → 404**, como define el contrato Spring Boot §4 (la spec, escrita para Supabase, esperaba 404 en ambos casos). |
| B6 | A cancela la cita de B → 404 y la de B sigue activa | Script | ⚠️ Responde **403** (contrato §4: la validación de dueño está en el `Service`). La cita de B sigue activa. La spec esperaba 404 porque en Supabase RLS oculta la fila. |

## F3 · Agenda diaria
| # | Criterio (resumen) | Cómo | Resultado |
|---|---|---|---|
| UI1 | Los contadores coinciden con la lista | Navegador | ✅ |
| UI2 | Completar sube "Completadas" y cambia la etiqueta | Navegador | ✅ también tras recargar |
| UI3 | Cancelar desde el panel libera el turno en `/cliente` | Navegador | ❌ **El panel solo permite "Rechazar" citas `pendiente`, pero todas las reservas nacen `confirmada`, así que no hay cómo cancelar una cita desde el panel.** La API sí lo permite (y libera el turno), pero falta el botón. |
| UI4 | El personal ve "Volver al panel" en `/cliente` y "Panel Principal" → `/admin` | Navegador (barbero) | ✅ |
| Back 20–21 | La cita aparece para el personal y el cambio de estado se conserva | Script + navegador | ✅ |
| B1 | Agenda del barbero ordenada, con hora de fin y sin correo ni teléfono | Script + navegador | ✅ "clientea Prueba · 16:00 – 16:40" |
| B2 | Cliente → 403 | Script | ✅ |
| B3 | Completar → PAGADO y EFECTIVO, con precio y reserva congelados | Script | ✅ |
| B4 | Barbero revierte una cita completada → 403 | Script | ✅ |
| B5 | Reactivar con el turno tomado → 409 | Script | ✅ |
| B6 | Cliente marca su cita como completada → 403 | Script | ✅ |

## F4 · Servicios, horario y usuarios
| # | Criterio (resumen) | Cómo | Resultado |
|---|---|---|---|
| UI1 | El barbero no ve Servicios, Horarios, Usuarios ni Contabilidad, y sus URLs lo devuelven a `/admin` | Navegador | ✅ menú: solo "Citas"; las 4 URLs → `/admin` |
| UI2 | El barbero ve el nombre del cliente, sin correo ni teléfono | Navegador | ✅ |
| UI3 | Cambiar el horario se refleja de inmediato en `/cliente` | Navegador | ✅ sin sábado → el sábado 28 aparece "cerrado"; luego se restauró |
| UI4 | Desactivar un servicio lo quita de `/` y de `/cliente` | Navegador | ✅ "Arreglo de cejas" oculto y luego restaurado |
| UI5 | Crear un servicio: aparece en el listado y se puede reservar | Navegador | ⚠️ Aparece y se puede reservar. **Falla menor:** la ventana "Nuevo Servicio" tiene un campo de reserva que `createServiceAction` no envía a la API. Se escribieron $3.000, quedó $0, y la lista mostraba $3.000 hasta recargar. |
| UI6 | Editar el rol actualiza la etiqueta de inmediato | Navegador | ✅ Cliente → Barbero, confirmado en la API |
| Back 28 | Los cambios se conservan | Script + navegador | ✅ (MySQL) |
| Back 29 | Un usuario promovido a barbero entra a `/admin` | Navegador | ✅ |
| Back 30 | Eliminar: desaparece de la tabla y no puede iniciar sesión | Navegador + script | ✅ login → 401 |
| Back 31 | Si el servidor rechaza un cambio, la pantalla lo muestra | 4.9 y pruebas | ✅ (mensajes de la API en pantalla) |
| Back 32 | Un cliente no puede cambiar el horario | Script | ✅ 403 |
| B1 | Editar servicio o reserva: las citas ya cobradas conservan sus montos | Script | ✅ |
| B2 | Reserva > precio, precio 0 o duración 0 → 400 | Script | ✅ |
| B3 | Horario inválido → 400; válido con turnos de 15 min → 200 | Script | ✅ |
| B4 | Cliente y barbero → 403 en las operaciones de admin | Script | ✅ (8 de 8) |
| B5 | El admin no puede borrarse ni quitarse el rol → 409 | Script | ✅ |
| B6 | Borrado seguro: libera el turno futuro, conserva el cobro y bloquea el login | Script | ✅ |

## F5 · Contabilidad (incluye 3.23–3.31)
| # | Criterio (resumen) | Cómo | Resultado |
|---|---|---|---|
| UI1 | Barbero y cliente no ven la contabilidad ni `/api/accounting/profit-report` | Navegador | ✅ página → `/admin` o `/cliente`; API → 403 |
| UI2 | Tarjetas con comparativa contra el periodo anterior | — | ➖ Reemplazado por la 3.28 (pantalla simple sin comparativas) |
| UI3 | Cambiar el periodo actualiza tarjetas y tabla | Navegador | ✅ "Mes actual": 2026-11-01 al 30, Ingresos $163.000, 10 movimientos (los filtros de barbero y servicio se quitaron en la 3.28) |
| UI4 | Registrar un gasto sube el total de Gastos | Navegador (4.9) + script | ✅ |
| UI5 | Exportar CSV | Navegador (4.9) + script | ✅ |
| UI6 (3.23) | Anular con motivo; sin motivo no se permite | Navegador (4.9, venta) + script (gasto) | ✅ |
| UI7 (3.24) | Editar $1.000 → $2.000 y el total refleja el cambio; un anulado no se edita | Navegador + script | ✅ Gastos $2.000 → $3.000; anulado → 409. **Observación:** al reabrir el detalle queda en modo edición. |
| UI8 (3.25) | Eliminar: desaparece de la tabla y de los totales, también al recargar | Navegador | ✅ |
| UI9 (3.26) | Ajustar pago; descuento + reembolso > precio → mensaje | Navegador (4.9) + script | ✅ |
| UI10 | Barbero o cliente no pueden hacer ajustes | Script | ✅ 403 (4 de 4) |
| 3.27 | 25.000 con reserva 5.000 → Ingresos 25.000, Reserva 5.000, Ganancia 20.000 | Script | ✅ |
| 3.27 | Cambiar la reserva después no altera el historial | Script | ✅ |
| 3.27 | Reserva 10.000 y gasto 12.000 → Saldo −2.000 en rojo | Script + navegador (rojo en 4.9) | ✅ |
| 3.28 | 5 tarjetas, sin "barbero" ni márgenes, la fila abre el detalle | Navegador | ✅ |
| 3.29 | Categoría de compras y propina aparte | Navegador (4.9) + script | ✅ |
| 3.30 | Venta: sube Ingresos y Ganancia; se anula o elimina | Navegador (4.9) + script | ✅ |
| 3.31 | 25.000 efectivo + 20.000 Nequi − 5.000 gasto en efectivo → caja 20.000 y Nequi 20.000 | Script + navegador | ✅ |
| Back 57–59 | Los cambios se conservan al recargar y desde otra sesión | Navegador + script | ✅ |
| B1–B8 | 401/403, 201, 400, anular, 409, ajuste de pago, CSV saneado, cierre de caja | Script | ✅ (8 de 8) |
| — | `/api/accounting/profit-report` (JSON) en modo API | Navegador | ❌ **Sigue leyendo Supabase**: devolvió $0 mientras la pantalla mostraba $163.000. La pantalla no se ve afectada porque usa la API directamente. Es el hallazgo 9 de la auditoría, todavía abierto. |

## Resumen
- **Fallas (❌), a corregir en la tarea 4.14:**
  1. La agenda no permite cancelar citas `confirmada` (F3-UI3).
  2. El JSON de `/api/accounting/profit-report` no usa la API (auditoría #9).
- **Diferencias con la spec (⚠️) y fallas menores:**
  - F2-B5 y F2-B6: 400/403 según el contrato Spring Boot, frente al 404 de la versión Supabase → **actualizar la spec**.
  - La reserva escrita al crear un servicio se pierde (F4-UI5) → corregir en la 4.14.
  - El resumen de la reserva no muestra la duración (F2-UI1) → corregir en la 4.14.
- **Observaciones de experiencia** (opcionales): la portada muestra solo 6 servicios; el correo se borra tras un login fallido; el detalle contable se reabre en modo edición.
- Todo lo demás cumple con el backend Spring Boot: **43 de 43** criterios del back en vivo y **85 de 85** pruebas automáticas.
