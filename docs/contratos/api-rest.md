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
| `POST /services` | `{ name, shortName, description, includes?, price, durationLabel, durationMinutes, icon, imageUrl?, reserveAmount? }` | `201 Service` | ADMIN |
| `PATCH /services/{id}/active` | — | `200 Service` (invierte `isActive`) | ADMIN |
| `PATCH /services/{id}/reserve` | `{ reserveAmount }` (0 ≤ monto ≤ precio) | `200 Service` | ADMIN |

`Service = { id, name, shortName, description, includes, price, durationLabel, durationMinutes, imageUrl, icon, isActive, sortOrder, reserveAmount }`.

- `GET` sin token o con rol distinto de ADMIN devuelve solo los activos; el ADMIN recibe todos salvo que envíe `onlyActive=true`.
- En `POST` solo `name` y `price` (≥ 1) son obligatorios. Si faltan → 400 "Nombre y precio son obligatorios.". Valores por defecto: `shortName` y `description` = `name`, `durationMinutes` = 30, `durationLabel` = "`{durationMinutes} min`", `icon` = `content_cut`. El servicio nuevo queda activo y al final del orden. `reserveAmount` es opcional (por defecto 0) y debe cumplir `0 ≤ reserveAmount ≤ price`; si no, 400 con el mensaje de la reserva (tarea 4.14).
- `reserve` mayor que el precio → 400 "La reserva no puede superar el precio del servicio."; id inexistente → 404 `NOT_FOUND`.
- **`PUT /services/{id}` (solo ADMIN, implementado en la 4.9):**
  - recibe los mismos campos que `POST` más `reserveAmount` (opcional, por defecto 0) y reemplaza el servicio completo;
  - aplica las mismas reglas y valores por defecto que crear, y además `0 ≤ reserveAmount ≤ price` (si no, 400 con el mensaje de la reserva);
  - no cambia `isActive` ni `sortOrder`;
  - solo afecta citas y cobros nuevos: las citas completadas conservan el valor cobrado y la reserva que quedaron fijados;
  - responde `200 Service`; id inexistente → 404.
  - Lo usa la pantalla "Editar servicio" (tarea T-B4).

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
| `GET /users?page=1&size=6&role=` | `role` opcional (filtra por rol) | `{ rows: user[], total }` | ADMIN | — |
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

## 6b. Ventas de productos (F5, tarea 3.30)
| Método y ruta | Cuerpo | Respuesta | Rol | Errores |
|---|---|---|---|---|
| `POST /product-sales` | `{ date, time?, concept, amount, paymentMethod? }` | `201 ProductSale` | ADMIN | 400 `"Por favor ingresa fecha, producto y un importe mayor a cero."` |
| `POST /product-sales/{id}/void` | `{ reason }` | `200` (`ANULADO` + `voidReason`, `voidedAt`) | ADMIN | 400 `"Escribe el motivo de la anulación."` · 409 `"Esta venta ya está anulada."` |
| `DELETE /product-sales/{id}` | — | `204` | ADMIN | 404 |

`ProductSale = { id, date, time, concept, amount, paymentMethod, status, voidReason, voidedAt }`.

- El importe se redondea a pesos enteros.
- Por defecto: `time` = `12:00` y `paymentMethod` = `EFECTIVO`.
- Igual que un gasto: **anular** conserva la venta con su motivo y deja de sumar; **eliminar** la borra sin rastro.
- No hay edición; para corregir una venta se anula y se registra de nuevo.
- La tabla `product_sales` llega con la migración Flyway `V2__ventas_de_productos.sql`.

## 7. Contabilidad (F5, modelo de reserva)
| Método y ruta | Parámetros | Respuesta | Rol |
|---|---|---|---|
| `GET /accounting/report` | `period=today\|this_week\|this_month\|last_month\|custom`, `startDate`, `endDate`, `page`, `size` | `{ period, summary: { income, productSales, yourProfit, businessReserve, expenses, reserveBalance, servicesCount, averageTicket, tips }, transactions: { rows, total, page, totalPages } }` | ADMIN |
| `GET /accounting/report.csv` | mismos | archivo `.csv` (celdas saneadas contra fórmulas `= + - @`) | ADMIN |
| `GET /accounting/cash-closing?date=` | `date` (`YYYY-MM-DD`; por defecto, hoy en Colombia) | `{ date, methods: [{ paymentMethod, income, tips, expenses, balance }], totals: { income, tips, expenses }, expectedCash }` | ADMIN |

**Cierre de caja (tarea 3.31):**
- `methods` siempre trae los 4 métodos en este orden: `EFECTIVO`, `NEQUI_DAVIPLATA`, `TRANSFERENCIA` y `TARJETA`, aunque alguno esté en 0.
- Por cada método, en el día indicado:
  - `income` = neto de las citas cobradas (mismas reglas del reporte) + ventas de productos `REGISTRADO`;
  - `tips` = propinas de esas citas;
  - `expenses` = gastos `REGISTRADO`;
  - `balance` = `income` + `tips` − `expenses`.
- `expectedCash` es el `balance` de `EFECTIVO`: el efectivo que debe haber en caja. Si es negativo, se pagó en efectivo más de lo cobrado.
- Las ventas y los gastos anulados no cuentan. Una fecha inválida → 400.

Fórmulas (spec F5): ingresos = Σ(precio − descuento − reembolso) de citas cobradas (+ ventas de productos, 3.30); reserva = Σ reserva fijada en cada cita; tu ganancia = ingresos − reserva; saldo = reserva − gastos registrados. Las propinas van aparte.

Detalles (tarea 4.8, mismas reglas que el motor actual `lib/accounting/`):
- **Periodo** (hora de Colombia):
  - `today`; `this_week` (lunes a domingo); `this_month` (por defecto); `last_month`;
  - `custom` exige `startDate` ≤ `endDate`, con un máximo de 366 días;
  - un periodo inválido → 400.
  - La respuesta incluye `period: { key, startDate, endDate }`.
- **Cita cobrada:** está `COMPLETADA`, con `paymentStatus` `PAGADO` o `REEMBOLSADO`, y su `date` cae en el periodo. Las pendientes, canceladas o anuladas no son movimientos de dinero.
- **Cálculo por cita:**
  - neto = `grossAmount` − descuento − reembolso;
  - la reserva es la fijada en la cita; si falta, la actual del servicio;
  - la reserva nunca supera el neto, y una cita reembolsada por completo (neto ≤ 0) no aparta reserva ni cuenta como servicio realizado.
- **Totales:**
  - `servicesCount` = citas con neto > 0;
  - `productSales` = Σ ventas de productos `REGISTRADO` (3.30). Ya están incluidas en `income` y en `yourProfit`, porque una venta no aparta reserva;
  - `averageTicket` = ingresos **por servicios** ÷ `servicesCount`, redondeado, o `null` si no hubo servicios. Las ventas de productos no lo cambian;
  - `tips` = Σ propinas de las citas cobradas;
  - `expenses` suma solo los gastos `REGISTRADO`.
- **`transactions.rows`:**
  - campos: `{ id, type: "INGRESO" | "VENTA" | "GASTO", date, time, concept, clientName, paymentMethod, income, expense, tip, status }`;
  - incluyen las citas cobradas (concepto = servicio, con el nombre del cliente), todas las ventas de productos y todos los gastos del periodo;
  - las ventas y los gastos anulados también se listan (`status = ANULADO`), pero no suman;
  - orden: fecha y hora descendentes;
  - `page` empieza en 1 y `size` va de 1 a 100 (por defecto 15).
- **CSV:**
  - UTF-8 con BOM (para que Excel muestre tildes) y separador `,`;
  - primero el resumen y después **todas** las filas del periodo, sin paginar;
  - una celda de texto que empieza con `=`, `+`, `-`, `@`, tabulador o retorno se antepone con `'`; las comillas se escapan (RFC 4180);
  - el archivo se descarga como `reporte-contable_{startDate}_{endDate}.csv`.
- **Pendiente como tarea aparte:** cierre de caja (3.31).

## 8. Conexión del frontend Next.js (tarea 4.9)
- **Modo de datos:** cada lectura (`lib/data/queries.ts`) y cada acción (`lib/actions.ts`) elige en este orden:
  1. **API Spring Boot**, si está definida `API_URL` (variable de servidor, **sin** `NEXT_PUBLIC_`; en local es `http://localhost:8080`);
  2. **Supabase**, si están sus variables (lo que hoy usa Vercel, hasta la 4.11);
  3. **modo demo** (store en memoria).
- **Cliente HTTP:** `lib/api/client.ts` (`server-only`) agrega `Authorization: Bearer` con el token de la cookie y devuelve `{ ok, data }` o `{ ok: false, code, message }`. Si la API no responde: `"No se pudo conectar con el servidor. Inténtalo de nuevo en unos minutos."`.
- **Adaptadores:** `lib/api/mappers.ts` convierte el JSON de la API (`camelCase`, enums en MAYÚSCULAS) a los tipos de `lib/types.ts` (`snake_case`, minúsculas). Así los componentes no cambian.
- **Sesión:**
  - login y registro guardan el JWT en la cookie `jm_api_token` (`httpOnly`, `sameSite=lax`, `secure` en producción, 7 días); el navegador nunca lo lee;
  - cerrar sesión borra la cookie;
  - `proxy.ts` valida la sesión con `GET /auth/me` en cada página: si la API responde 401, borra la cookie y trata al visitante como sin sesión;
  - las reglas de rutas por rol no cambian.
- **Contabilidad:** la página pide `GET /accounting/report` y lo adapta al formato de sus componentes, sin recalcular nada en el frontend. En modo API, el Route Handler `/api/accounting/profit-report` también usa la API: el JSON (`GET` y `POST`) devuelve el reporte adaptado, y el CSV se reenvía desde `GET /accounting/report.csv`. Nunca lee Supabase cuando existe `API_URL` (tarea 4.14, auditoría #9).
- **Funciones que solo existen en Spring Boot** (decisión del 2026-11-20): la propina al ajustar un pago (3.29), la categoría "Compra de insumos / productos" (3.29), las ventas de productos (3.30) y el cierre de caja (3.31). Solo se muestran en modo API.
- **Seguridad del frontend (tarea 4.13, auditoría hallazgos 3 y 7):**
  - `lib/data/queries.ts` es `server-only`: sus lecturas solo se llaman desde páginas y acciones del servidor, nunca como acción desde el navegador;
  - lo único que el navegador puede invocar es `lib/data/public-actions.ts` (`"use server"`): `getBookedRangesByDate(date)`, que valida `date` como `YYYY-MM-DD` real y devuelve rangos sin datos personales;
  - `getNextAppointment()` no recibe un id: siempre es la del usuario de la sesión;
  - `return_url` / `next` pasan por `safeReturnPath()` (`lib/safe-redirect.ts`). Solo se acepta una ruta interna: empieza con `/`, no con `//`, sin `\` ni caracteres de control, y del mismo origen al interpretarla. Si no cumple, se ignora y se va al panel según el rol. Lo usan `loginAction` y `proxy.ts`.
- **Ajustes del backend para esta tarea:**
  - `GET /users` acepta `role=CLIENTE|BARBERO|ADMIN` (opcional) para filtrar y contar;
  - las filas de `transactions.rows` agregan `discount`, `refund`, `category`, `reference`, `voidReason` y `voidedAt`, que el detalle del movimiento necesita para editar o ajustar. Estos campos van en `null` (o 0 en los montos) cuando no aplican.

## Equivalencia con el contrato actual
| Hoy (Next.js + Supabase) | Spring Boot |
|---|---|
| `loginAction` / `registerAction` / `logoutAction` | `POST /auth/login` · `POST /auth/register` · el frontend borra su cookie |
| `getServices` · `createServiceAction` · `toggleServiceActiveAction` · `updateServiceReserveAction` | `GET /services` · `POST /services` · `PATCH /services/{id}/active` · `PATCH /services/{id}/reserve` |
| `getBusinessHours` · `updateBusinessHoursAction` | `GET` / `PUT /business-hours` |
| `getBookedRangesByDate` (`/appointments/booked-ranges`) · `createAppointmentAction` · `getNextAppointment` · `getAppointmentsByDate` · `updateAppointmentStatusAction` · `adjustAppointmentPaymentAction` | `/appointments/...` |
| `getProfilesPage` · `updateUserAction` · `deleteUserAction` | `/users/...` |
| `createExpenseAction` · `updateExpenseAction` · `voidExpenseAction` · `deleteExpenseAction` | `/expenses/...` |
| `/api/accounting/profit-report` | `/accounting/report` (+ `.csv`) |
| RLS + `get_my_role()` + `requireRole` | Spring Security (`@PreAuthorize`) + validación por dueño en el servicio |

## 9. Alineación con el modelo U4 (`docs/datos/modelo.md`, tarea 4.12 · migración Flyway `V3`)
> Cambios acordados en la entrevista de datos U4, sin editar `V1` ni `V2`. Detalle de la implementación (tarea 4.12):
- **Migración `V3__duracion_y_borrado_seguro.sql`:**
  - agrega `appointments.end_time TIME NOT NULL` (las citas existentes se completan con `time` + la duración del servicio) y el `CHECK (end_time > time)`;
  - deja `appointments.client_id` en `NULL` permitido, con la FK en `ON DELETE SET NULL`.
- **Reservar (`POST /appointments`):**
  - el servidor calcula `end_time = time + durationMinutes` del servicio; el cliente nunca lo envía;
  - el rango `[time, end_time)` debe empezar en un turno del horario (`slotMinutes`), terminar a más tardar al cierre y no cruzar el descanso. Si no → 400 `"Ese horario no está disponible. Elige un turno de la lista."`;
  - si se solapa con otra cita no cancelada de ese día → 409 `SLOT_TAKEN`.
  - **Concurrencia:** MySQL no tiene restricciones de exclusión, así que cada reserva o reactivación bloquea la fila única de `business_hours` (`SELECT … FOR UPDATE`) mientras revisa el solapamiento. Las reservas se procesan una a la vez y dos rangos solapados nunca quedan guardados. El `UNIQUE` del turno activo sigue como segunda barrera.
- **`GET /appointments/booked-ranges?date=`** (con sesión): `[{ "start": "09:00", "end": "10:00" }]`, los rangos ocupados de citas no canceladas, por hora, sin datos personales. `booked-slots` se mantiene.
- **`Appointment`** agrega `endTime` (`"HH:mm"`). Si el cliente fue eliminado: `clientId = null` y `clientName = "Cliente eliminado"`. Lo mismo en las filas del reporte contable.
- **Cambiar estado:**
  - si la cita está `COMPLETADA`, solo el `ADMIN` puede cambiar su estado; el `BARBERO` recibe 403 `FORBIDDEN` y el cobro no se altera;
  - reactivar una cita cancelada también revisa el solapamiento (409 `SLOT_TAKEN`).
- **Borrar usuario (`DELETE /users/{id}`):**
  - antes de borrarlo se cancelan sus citas activas (`PENDIENTE`/`CONFIRMADA`) que aún no han pasado, para liberar los turnos;
  - las demás citas quedan con `client_id = NULL` y se conservan en la contabilidad.
- **Errores genéricos** (auditoría, hallazgo 8). Siempre en español y sin detalles internos (el detalle va al log):
  - conflicto de integridad no previsto → 409 `CONFLICT` `"No se pudo guardar porque entra en conflicto con otros datos."`;
  - método no permitido → 405 `METHOD_NOT_ALLOWED` `"Esta operación no está permitida."`;
  - ruta inexistente → 404 `NOT_FOUND` `"El recurso no existe."`;
  - cualquier otro error → 500 `INTERNAL_ERROR` `"Ocurrió un error inesperado. Inténtalo de nuevo."`.

Resumen original de la alineación:
- ~~`PUT /services/{id}`~~: ya implementado en la tarea 4.9 (ver §2).
- **Duración real y no solapamiento en citas (`appointments.end_time`):** migración `V3` agrega `end_time TIME NOT NULL` (congelado al reservar como `time + service.durationMinutes`), valida en `AppointmentService` que el rango `[time, end_time)` quepa dentro de `business_hours` sin cruzar descanso ni solaparse con otra cita no cancelada (`409 SLOT_TAKEN`), y expone rangos ocupados (`GET /appointments/booked-ranges?date=`).
- **Borrado seguro de usuarios (`ON DELETE SET NULL`):** migración `V3` permite `appointments.client_id NULL` y cambia la FK a `ON DELETE SET NULL`; antes de borrar el usuario en `UserAdminService.delete`, se cancelan sus citas futuras activas para liberar los turnos, conservando las citas históricas como `"Cliente eliminado"` en contabilidad.
- **Cerradura de rol `BARBERO` sobre citas completadas:** en `PATCH /appointments/{id}/status`, si el estado actual es `COMPLETADA`, solo `ADMIN` puede modificarlo (`BARBERO` recibe `403 FORBIDDEN`).
