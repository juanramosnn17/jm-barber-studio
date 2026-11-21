# Contrato API REST · Backend Spring Boot (Unidad 4)

> Contrato del backend en **Spring Boot 4.2 + Java 21 + MySQL** (carpeta `backend/`). Reemplaza a Supabase manteniendo las **mismas reglas de negocio** de `docs/specs/F1..F5` y del contrato actual `docs/contratos/api.md`. Si un endpoint cambia, se actualiza aquí **antes** del código.

## Convenciones
- **Base URL:** `http://localhost:8080/api/v1` (local). En producción, la variable `API_URL` del frontend.
- **Formato:** JSON en `camelCase`. Fechas `YYYY-MM-DD`, horas `HH:mm` (24 h, hora de Colombia `America/Bogota`). Dinero en COP como número entero.
- **Autenticación:** JWT firmado (HS256) en el encabezado `Authorization: Bearer <token>`. El frontend Next.js lo guarda en una cookie `httpOnly` y lo envía desde el servidor; el navegador nunca lo lee.
- **Roles:** `CLIENTE`, `BARBERO`, `ADMIN`. Cada endpoint indica quién puede usarlo; Spring Security lo valida **en el servidor** (equivale a RLS + `requireRole`).
- **Errores:** siempre con el mismo cuerpo y en español:
  ```json
  { "status": 409, "code": "SLOT_TAKEN", "message": "Este bloque horario ya está ocupado. Por favor elige otro turno." }
  ```
  | HTTP | Cuándo |
  |---|---|
  | 400 | Datos inválidos (`VALIDATION_ERROR`) |
  | 401 | Sin token o token vencido (`UNAUTHORIZED`) |
  | 403 | Rol sin permiso (`FORBIDDEN`): `"No tienes permisos para realizar esta acción."` |
  | 404 | Recurso inexistente (`NOT_FOUND`) |
  | 409 | Conflicto de negocio (turno ocupado, gasto ya anulado…) |

## 1. Autenticación (F1)
| Método y ruta | Cuerpo | Respuesta | Rol | Errores |
|---|---|---|---|---|
| `POST /auth/register` | `{ firstName, lastName, email, phone, password, confirmPassword, acceptsDataUse }` (contraseña de 6 a 72 caracteres; `acceptsDataUse` debe ser `true`) | `201 { token, user }` · el rol siempre es `CLIENTE`, aunque el cuerpo traiga otro | público | 400 `"Las contraseñas no coinciden."` · 409 `EMAIL_TAKEN` `"Ya existe una cuenta con ese correo. Inicia sesión."` |
| `POST /auth/login` | `{ email, password }` | `200 { token, user }` | público | 401 `"Credenciales incorrectas. Verifica tu correo y contraseña o regístrate si aún no tienes cuenta."` |
| `GET /auth/me` | — | `200 user` | con sesión | 401 |

`user = { id, firstName, lastName, email, phone, role }`. Contraseñas con **BCrypt**; nunca se devuelven. El correo se guarda en minúsculas. El token dura **7 días** (`jwt.expiration-hours=168`) y lleva `sub` = id del usuario y `role`. **En cada petición** la API toma el rol actual desde la base, no el del token (tarea 4.6). Así, un cambio de rol se aplica de inmediato y el token de una cuenta eliminada responde 401.

## 2. Servicios (F1, F4)
| Método y ruta | Cuerpo / parámetros | Respuesta | Rol |
|---|---|---|---|
| `GET /services?onlyActive=true` | — | `Service[]` por `sortOrder` | público (activos) · ADMIN (todos) |
| `POST /services` | `{ name, shortName, description, includes?, price, durationLabel, durationMinutes, icon, imageUrl? }` | `201 Service` | ADMIN |
| `PATCH /services/{id}/active` | — | `200 Service` (invierte `isActive`) | ADMIN |
| `PATCH /services/{id}/reserve` | `{ reserveAmount }` (0 ≤ monto ≤ precio) | `200 Service` | ADMIN |

`Service = { id, name, shortName, description, includes, price, durationLabel, durationMinutes, imageUrl, icon, isActive, sortOrder, reserveAmount }`.

- `GET` sin token o con rol distinto de ADMIN devuelve solo los activos; el ADMIN recibe todos salvo que envíe `onlyActive=true`.
- En `POST` solo `name` y `price` (≥ 1) son obligatorios. Si faltan → 400 "Nombre y precio son obligatorios.". Valores por defecto: `shortName` y `description` = `name`, `durationMinutes` = 30, `durationLabel` = "`{durationMinutes} min`", `icon` = `content_cut`. El servicio nuevo queda activo, al final del orden y con reserva 0.
- `reserve` mayor que el precio → 400 "La reserva no puede superar el precio del servicio."; id inexistente → 404 `NOT_FOUND`.

## 3. Horario de atención (F2, F4)
| Método y ruta | Cuerpo | Respuesta | Rol |
|---|---|---|---|
| `GET /business-hours` | — | `{ openDays: number[], openTime, closeTime, breakStart, breakEnd, slotMinutes }` | público |
| `PUT /business-hours` | mismos campos | `200` con el horario guardado | ADMIN |

Horas en formato `"HH:mm"`; días de 0 (domingo) a 6 (sábado), al menos uno; `slotMinutes` de 10 a 240. Para no tener descanso, se envían `breakStart` y `breakEnd` en `null`. Errores 400:
- cierre igual o anterior a la apertura;
- descanso con un solo extremo;
- descanso fuera del horario o que termina antes de empezar.

## 4. Citas (F2, F3)
| Método y ruta | Cuerpo / parámetros | Respuesta | Rol | Errores |
|---|---|---|---|---|
| `GET /appointments/booked-slots?date=` | — | `string[]` horas ocupadas, sin datos personales | con sesión | — |
| `POST /appointments` | `{ serviceId, date, time, notes? }` | `201 Appointment` (estado `CONFIRMADA`, a nombre del usuario) | con sesión | 400 `"No puedes reservar en una fecha u hora que ya pasó."` · 409 `SLOT_TAKEN` |
| `GET /appointments/next` | — | `Appointment` o `204` | con sesión (las propias) |
| `GET /appointments?date=` | — | `Appointment[]` del día por hora | ADMIN, BARBERO |
| `PATCH /appointments/{id}/status` | `{ status }` | `200 Appointment`. Al pasar a `COMPLETADA` fija pago en efectivo y la **reserva** del servicio | ADMIN, BARBERO (cualquier estado) · CLIENTE (solo `CANCELADA` en las suyas) | 403 |
| `PATCH /appointments/{id}/payment` | `{ paymentMethod, discountAmount, refundAmount, tipAmount }` | `200` | ADMIN | 400 `"El descuento y el reembolso no pueden superar el valor del servicio."` · 409 `"Solo se puede ajustar el pago de una cita completada."` |

`Appointment = { id, clientId, clientName, serviceId, serviceName, durationLabel, date, time, status, notes, paymentStatus, paymentMethod }`. Para BARBERO, `clientName` es solo nombre y apellido; nunca correo ni teléfono.

Detalles (tarea 4.5):
- `POST /appointments` exige `serviceId`, `date` (`YYYY-MM-DD`) y `time` (`HH:mm`). Responde:
  - 404 si el servicio no existe y 400 `"Este servicio no está disponible."` si está inactivo;
  - 400 `"Ese horario no está disponible. Elige un turno de la lista."` si el día está cerrado o la hora no coincide con un turno del horario de atención (fuera de horario, en el descanso o desalineada con `slotMinutes`);
  - 400 por el pasado y 409 `SLOT_TAKEN` como dice la tabla. El índice `UNIQUE` también cubre dos reservas simultáneas.
- `GET /appointments/next` sirve para cualquier usuario con sesión y devuelve **su** próxima cita `PENDIENTE` o `CONFIRMADA` que aún no haya pasado.
- `GET /appointments?date=` (agenda) no incluye las canceladas.
- `PATCH /appointments/{id}/status` acepta `{ status }` entre `PENDIENTE`, `CONFIRMADA`, `EN_CURSO`, `COMPLETADA` y `CANCELADA`.
  - **Cliente:** solo puede pasar a `CANCELADA` una cita suya. Si es ajena → 403; si ya está completada, cancelada o en curso → 409 `"Esta cita ya no se puede cancelar."`.
  - **Al completar:** `paymentStatus = PAGADO`, `paymentMethod = EFECTIVO`, `grossAmount` = precio del servicio, `reserveAmount` = reserva del servicio en ese momento, `paidAt` = ahora.
  - **Al cancelar:** `paymentStatus = ANULADO`.
  - **Si una cita completada vuelve a otro estado activo:** se borran el cobro, la reserva, el descuento, el reembolso y la propina (`paymentStatus = PENDIENTE`).
  - **Si una cita cancelada se reactiva en un turno que ya tomó otra persona:** 409 `SLOT_TAKEN`.
  - Id inexistente → 404.

**Ajuste de pago (tareas 3.26, 3.29 y 4.7):** `PATCH /appointments/{id}/payment` es solo para el ADMIN y recibe `{ paymentMethod, discountAmount, refundAmount, tipAmount }`.
- **Validaciones:**
  - los montos se redondean a pesos enteros;
  - un monto negativo → 400;
  - `discountAmount + refundAmount` mayor que el valor cobrado (`grossAmount`) → 400 con el mensaje de la tabla;
  - la cita no está `COMPLETADA` → 409 `NOT_COMPLETED`;
  - id inexistente → 404.
- **Resultado:** `paymentStatus` queda `REEMBOLSADO` si hay reembolso y `PAGADO` si no.
- **Respuesta:** `200 { id, paymentStatus, paymentMethod, grossAmount, discountAmount, refundAmount, tipAmount, netAmount }`, con `netAmount = grossAmount − discountAmount − refundAmount`.
- La **propina** no suma a los ingresos ni a la reserva; se reporta aparte (F5).

**Regla de negocio (F2):** una sola cita no cancelada por `(date, time)`. MySQL no tiene índices parciales, así que se usa una columna generada `active_slot` (vale `date+time` si no está cancelada y `NULL` si lo está) con índice `UNIQUE`; MySQL permite varios `NULL`.

## 5. Usuarios (F4)
| Método y ruta | Cuerpo / parámetros | Respuesta | Rol | Errores |
|---|---|---|---|---|
| `GET /users?page=1&size=6` | — | `{ rows: user[], total }` | ADMIN | — |
| `PUT /users/{id}` | `{ firstName, lastName, email, phone, role }` | `200 user` | ADMIN | 409 `"No puedes quitarte a ti mismo el rol de administrador."` |
| `DELETE /users/{id}` | — | `204` | ADMIN | 409 `"No puedes eliminar tu propia cuenta."` |

Detalles (tarea 4.6):
- **Listado:**
  - `page` empieza en 1 y `size` va de 1 a 50 (por defecto 6);
  - el orden es ADMIN → BARBERO → CLIENTE y luego por nombre;
  - `user` nunca incluye la contraseña.
- **`PUT`:**
  - `firstName` y un `email` válido son obligatorios; si faltan → 400 `"Nombre y correo son obligatorios."`;
  - el correo se guarda en minúsculas; si es de otra cuenta → 409 `EMAIL_TAKEN`;
  - id inexistente → 404.
- **`DELETE`:** también borra las citas de ese cliente (`ON DELETE CASCADE`); id inexistente → 404.
- **Primer admin:** se crea con `backend/scripts/promote-admin.ps1 -Email <correo>` sobre una cuenta ya registrada. El registro público nunca crea admins.

## 6. Gastos (F5)
| Método y ruta | Cuerpo | Respuesta | Rol | Errores |
|---|---|---|---|---|
| `POST /expenses` | `{ date, time?, category, concept, amount, paymentMethod, reference? }` | `201 Expense` | ADMIN | 400 `"Por favor ingresa fecha, concepto y un importe mayor a cero."` |
| `PUT /expenses/{id}` | mismos campos | `200` (solo si está `REGISTRADO`) | ADMIN | 409 `"Un gasto anulado no se puede editar."` |
| `POST /expenses/{id}/void` | `{ reason }` | `200` (`ANULADO` + `voidReason`, `voidedAt`) | ADMIN | 400 `"Escribe el motivo de la anulación."` · 409 `"Este gasto ya está anulado."` |
| `DELETE /expenses/{id}` | — | `204` | ADMIN | 404 |

`Expense = { id, date, time, category, concept, amount, paymentMethod, status, reference, voidReason, voidedAt }`.

Detalles (tarea 4.7):
- **Al crear o editar:**
  - `date`, `concept` y `amount` > 0 son obligatorios;
  - el importe se redondea a pesos enteros;
  - por defecto: `time` = `12:00`, `category` = `OTROS`, `paymentMethod` = `TRANSFERENCIA`;
  - `PUT` reemplaza el gasto completo: un campo que no se envía vuelve a su valor por defecto, así que el frontend envía todos los campos.
- **Errores:**
  - categoría o método de pago inexistente → 400;
  - editar o anular un id inexistente → 404;
  - motivo de anulación de más de 300 caracteres → 400.
- **Anular:** el gasto se conserva con su motivo pero deja de sumar en los totales (4.8). **Eliminar** lo borra sin rastro.

Categorías: `ARRIENDO`, `SERVICIOS_PUBLICOS`, `NOMINA_ADMINISTRATIVA`, `INSUMOS_GENERALES`, `COMPRA_INSUMOS_PRODUCTOS` (tarea 3.29), `PUBLICIDAD`, `MANTENIMIENTO`, `OTROS`.

## 7. Contabilidad (F5, modelo de reserva)
| Método y ruta | Parámetros | Respuesta | Rol |
|---|---|---|---|
| `GET /accounting/report` | `period=today\|this_week\|this_month\|last_month\|custom`, `startDate`, `endDate`, `page`, `size` | `{ summary: { income, yourProfit, businessReserve, expenses, reserveBalance, servicesCount, averageTicket, tips }, transactions: { rows, total, page, totalPages } }` | ADMIN |
| `GET /accounting/report.csv` | mismos | archivo `.csv` (celdas saneadas contra fórmulas `= + - @`) | ADMIN |

Fórmulas (spec F5): ingresos = Σ(precio − descuento − reembolso) de citas cobradas (+ ventas de productos, 3.30); reserva = Σ reserva fijada en cada cita; tu ganancia = ingresos − reserva; saldo = reserva − gastos registrados. Las propinas van aparte.

## Equivalencia con el contrato actual
| Hoy (Next.js + Supabase) | Spring Boot |
|---|---|
| `loginAction` / `registerAction` / `logoutAction` | `POST /auth/login` · `POST /auth/register` · el frontend borra su cookie |
| `getServices` · `createServiceAction` · `toggleServiceActiveAction` · `updateServiceReserveAction` | `GET /services` · `POST /services` · `PATCH /services/{id}/active` · `PATCH /services/{id}/reserve` |
| `getBusinessHours` · `updateBusinessHoursAction` | `GET` / `PUT /business-hours` |
| `getBookedSlotsByDate` · `createAppointmentAction` · `getNextAppointment` · `getAppointmentsByDate` · `updateAppointmentStatusAction` · `adjustAppointmentPaymentAction` | `/appointments/...` |
| `getProfilesPage` · `updateUserAction` · `deleteUserAction` | `/users/...` |
| `createExpenseAction` · `updateExpenseAction` · `voidExpenseAction` · `deleteExpenseAction` | `/expenses/...` |
| `/api/accounting/profit-report` | `/accounting/report` (+ `.csv`) |
| RLS + `get_my_role()` + `requireRole` | Spring Security (`@PreAuthorize`) + validación por dueño en el servicio |
