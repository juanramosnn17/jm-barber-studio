# Contrato de API · JM Barber Studio

> Plano de instalaciones del backend del MVP sobre **Next.js Route Handlers (`app/api/...`) + Supabase (PostgreSQL + Auth + RLS)**, derivado de `docs/datos/modelo.md` y las especificaciones `docs/specs/F1..F5`.
> Ninguna operación se implementa antes de estar acordada aquí.

## Convenciones generales
- **Base:** `/api` (Route Handlers en `app/api/.../route.ts`).
- **Formato:** JSON en `snake_case` alineado con `docs/datos/modelo.md`.
- **Fechas y horas:** `date` = `"YYYY-MM-DD"`, `time` / `end_time` = `"HH:MM"` (24 h, zona horaria `America/Bogota`).
- **Dinero:** pesos colombianos (**COP**) como número entero sin decimales.
- **Autenticación y sesión:** el usuario y su rol (`cliente`, `barbero`, `admin`) se obtienen **siempre en el servidor** desde la sesión de Supabase (`supabase.auth.getUser()`) y la tabla `profiles` (`get_my_role()`), nunca desde el cuerpo ni la URL.
- **Formato de errores:** todos los errores responden JSON con forma uniforme y mensajes pensados para el usuario; **nunca** se exponen mensajes de Postgres, nombres de tablas, consultas ni trazas internas (los detalles técnicos solo van al log del servidor):
  ```json
  { "error": "Mensaje claro para el usuario" }
  ```
- **Códigos HTTP estándar:**
  | Código | Significado | Mensaje genérico cuando aplica |
  |---|---|---|
  | `400` | Datos de entrada inválidos (Zod o regla de entrada) | Específico del campo/regla |
  | `401` | Sin sesión o sesión expirada | `"Inicia sesión para continuar."` |
  | `403` | Con sesión pero sin permiso para el rol o recurso | `"No tienes permisos para realizar esta acción."` |
  | `404` | Recurso inexistente (o fuera del alcance RLS del usuario) | Específico del recurso |
  | `409` | Conflicto con el estado actual (turno cruzado, gasto anulado, auto-eliminación) | Específico del conflicto |
  | `500` | Error inesperado del servidor | `"Ocurrió un error inesperado. Inténtalo de nuevo."` |

---

## 1. Autenticación (F1)

### `POST /api/auth/register`
**Quién:** Público (sin sesión).

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `first_name` | `string` | Obligatorio, 1–80 caracteres (sin solo espacios) |
| `last_name` | `string` | Opcional, hasta 80 caracteres (por defecto `""`) |
| `email` | `string` | Obligatorio, formato de correo válido (se guarda en minúsculas) |
| `phone` | `string \| null` | Opcional, formato teléfono Colombia (`+57 ...`) |
| `password` | `string` | Obligatorio, 6–72 caracteres |
| `confirm_password` | `string` | Obligatorio, igual a `password` |
| `accepts_data_use` | `boolean` | Obligatorio, debe ser `true` |

> El servidor ignora cualquier `role` enviado: el trigger en BD siempre crea el perfil con `role = "cliente"`.

**`201 Created`:**
```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-4789-9012-abcdef123456",
    "first_name": "Mateo",
    "last_name": "Gómez",
    "email": "mateo@ejemplo.com",
    "phone": "+57 3001234567",
    "role": "cliente"
  }
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Faltan campos obligatorios, correo inválido o contraseña < 6 caracteres | `"Por favor completa todos los campos obligatorios."` |
| `400` | `password !== confirm_password` | `"Las contraseñas no coinciden."` |
| `400` | `accepts_data_use` no es `true` | `"Debes aceptar la autorización de datos para registrarte."` |
| `409` | El correo ya está registrado | `"Ya existe una cuenta con ese correo. Inicia sesión."` |

---

### `POST /api/auth/login`
**Quién:** Público.

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `email` | `string` | Obligatorio, formato correo |
| `password` | `string` | Obligatorio, no vacío |

**`200 OK`:**
```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-4789-9012-abcdef123456",
    "first_name": "Mateo",
    "last_name": "Gómez",
    "email": "mateo@ejemplo.com",
    "phone": "+57 3001234567",
    "role": "cliente"
  },
  "redirect_to": "/cliente"
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Falta correo o contraseña | `"Por favor ingresa tu correo y tu contraseña."` |
| `401` | Credenciales incorrectas | `"Credenciales incorrectas. Verifica tu correo y contraseña o regístrate si aún no tienes cuenta."` |

---

### `POST /api/auth/logout`
**Quién:** Usuario con sesión. Cierra sesión únicamente en el dispositivo actual (`scope: "local"`).

**`204 No Content`** (sin cuerpo).

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `401` | Sin sesión activa | `"Inicia sesión para continuar."` |

---

### `GET /api/auth/me`
**Quién:** Usuario con sesión. Lee el perfil y rol actual desde `profiles`.

**`200 OK`:**
```json
{
  "id": "a1b2c3d4-e5f6-4789-9012-abcdef123456",
  "first_name": "Mateo",
  "last_name": "Gómez",
  "email": "mateo@ejemplo.com",
  "phone": "+57 3001234567",
  "role": "cliente"
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `401` | Sin sesión o cuenta eliminada | `"Inicia sesión para continuar."` |

---

## 2. Servicios (F1, F4, F5)

### `GET /api/services`
**Quién:** Cualquiera. Visitantes, `cliente` y `barbero` reciben solo `is_active = true`; `admin` recibe todos salvo que envíe `?only_active=true`.

**Parámetros query:** `only_active` (`"true"` | `"false"`, opcional).

**`200 OK`:**
```json
[
  {
    "id": "5f9a0e10-1111-4222-8333-000000000001",
    "name": "Corte de cabello",
    "short_name": "Corte",
    "description": "Corte técnico personalizado a tijera y máquina.",
    "includes": "Lavado + Peinado",
    "price": 25000,
    "reserve_amount": 5000,
    "duration_label": "60 min",
    "duration_minutes": 60,
    "image_url": "/images/servicios/corte-cabello.jpg",
    "icon": "content_cut",
    "is_active": true,
    "sort_order": 1
  }
]
```

---

### `POST /api/services`
**Quién:** Exclusivo `admin`.

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `name` | `string` | Obligatorio, 1–120 caracteres |
| `short_name` | `string` | Opcional (por defecto `name`), 1–60 caracteres |
| `description` | `string` | Opcional (por defecto texto estándar) |
| `includes` | `string \| null` | Opcional |
| `price` | `integer` | Obligatorio, entero > 0 (COP) |
| `reserve_amount` | `integer` | Opcional (por defecto `0`), entero entre `0` y `price` |
| `duration_minutes` | `integer` | Opcional (por defecto `30`), entero > 0 |
| `duration_label` | `string` | Opcional (por defecto `"{duration_minutes} min"`) |
| `image_url` | `string \| null` | Opcional |
| `icon` | `string` | Opcional (por defecto `"content_cut"`) |

**`201 Created`:** devuelve el objeto `Service` creado.

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Falta nombre o precio ≤ 0 | `"Nombre y precio válido son obligatorios."` |
| `400` | `duration_minutes <= 0` | `"La duración debe ser mayor a cero minutos."` |
| `400` | `reserve_amount < 0` o `reserve_amount > price` | `"La reserva debe estar entre $0 y el precio del servicio."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |

---

### `PUT /api/services/:id`
**Quién:** Exclusivo `admin`. Permite editar los datos de un servicio existente (nombre, precio, duración en minutos, etiqueta de duración, reserva fija, descripción, qué incluye, imagen). Los cambios solo afectan reservas/cobros nuevos; las citas previas conservan su `end_time`, `gross_amount` y `reserve_amount` congelados.

**Entrada (JSON):** mismos campos y validaciones que `POST /api/services`.

**`200 OK`:** devuelve el objeto `Service` actualizado.

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Datos inválidos, `price <= 0`, `duration_minutes <= 0` o `reserve_amount > price` | `"Revisa el nombre, el precio, la duración y la reserva del servicio."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | El servicio no existe | `"No se encontró el servicio."` |

---

### `PATCH /api/services/:id/active`
**Quién:** Exclusivo `admin`. Alterna `is_active` (desactivación/activación lógica; nunca borra el servicio).

**`200 OK`:**
```json
{ "id": "5f9a0e10-1111-4222-8333-000000000001", "is_active": false }
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | El servicio no existe | `"No se encontró el servicio."` |

---

### `PATCH /api/services/:id/reserve`
**Quién:** Exclusivo `admin`. Actualiza únicamente `reserve_amount` de un servicio.

**Entrada (JSON):** `{ "reserve_amount": integer }` (`0 <= reserve_amount <= price`).

**`200 OK`:**
```json
{ "id": "5f9a0e10-1111-4222-8333-000000000001", "reserve_amount": 6000 }
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Monto negativo o mayor que `price` | `"La reserva no puede ser negativa ni superar el precio del servicio."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | El servicio no existe | `"No se encontró el servicio."` |

---

## 3. Horario de atención (F2, F4)

### `GET /api/business-hours`
**Quién:** Público.

**`200 OK`:**
```json
{
  "open_days": [1, 2, 3, 4, 5, 6],
  "open_time": "09:00",
  "close_time": "20:00",
  "break_start": "14:00",
  "break_end": "15:00",
  "slot_minutes": 30
}
```

---

### `PUT /api/business-hours`
**Quién:** Exclusivo `admin`. Actualiza la fila única (`id = 1`), incluido `slot_minutes`.

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `open_days` | `integer[]` | Obligatorio, al menos 1 día, valores únicos entre `0` y `6` |
| `open_time` | `string` | Obligatorio, `"HH:MM"` |
| `close_time` | `string` | Obligatorio, `"HH:MM"`, mayor que `open_time` |
| `break_start` | `string \| null` | Opcional; si se envía, `break_end` es obligatorio |
| `break_end` | `string \| null` | Opcional; si existe: `open_time <= break_start < break_end <= close_time` |
| `slot_minutes` | `integer` | Obligatorio, entero entre `10` y `120` (ej. `15`, `30`, `45`, `60`) |

**`200 OK`:** devuelve el horario actualizado.

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Cierre ≤ apertura, días inválidos, pausa incoherente o `slot_minutes` fuera de rango | `"Revisa los días, el horario de atención, el almuerzo y la duración de los bloques."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |

---

## 4. Citas y agenda (F2, F3, F5)

### `GET /api/appointments/availability?date=YYYY-MM-DD&service_id=UUID`
**Quién:** Usuario con sesión. Consulta `business_hours`, la duración del servicio (`services.duration_minutes`) y los rangos ocupados mediante la función controlada `get_booked_ranges(date)` (sin exponer nombres ni IDs de otros clientes). Devuelve únicamente las horas de inicio donde **cabe completo** el servicio sin cruzar citas existentes, el almuerzo, el cierre ni horas pasadas (hora Colombia).

**Parámetros query:** `date` (`YYYY-MM-DD`, obligatorio), `service_id` (`uuid`, obligatorio).

**`200 OK`:**
```json
{
  "date": "2026-11-21",
  "service_id": "5f9a0e10-1111-4222-8333-000000000001",
  "duration_minutes": 60,
  "is_open": true,
  "available_slots": ["09:00", "10:00", "11:00", "15:00", "16:00"],
  "booked_ranges": [{ "start_time": "12:00", "end_time": "13:00" }]
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Fecha o `service_id` con formato inválido | `"Revisa la fecha y el servicio seleccionados."` |
| `401` | Sin sesión | `"Inicia sesión para consultar la disponibilidad."` |
| `404` | El servicio no existe o está inactivo | `"Ese servicio no está disponible."` |

---

### `POST /api/appointments`
**Quién:** Usuario con sesión (`cliente`, `barbero` o `admin`). Crea una cita a nombre del usuario autenticado (`client_id = auth.uid()`). El servidor calcula y congela `end_time = time + service.duration_minutes`.

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `service_id` | `uuid` | Obligatorio; servicio existente y `is_active = true` |
| `date` | `string` | Obligatorio, `"YYYY-MM-DD"`, hoy o futuro (hora Colombia) |
| `time` | `string` | Obligatorio, `"HH:MM"`, alineado con `slot_minutes` desde `open_time`, cuyo rango `[time, end_time)` quepa dentro del horario y fuera del almuerzo |
| `notes` | `string \| null` | Opcional, hasta 500 caracteres |

**`201 Created`:**
```json
{
  "id": "b1c2d3e4-5678-49ab-cdef-1234567890ab",
  "client_id": "a1b2c3d4-e5f6-4789-9012-abcdef123456",
  "service_id": "5f9a0e10-1111-4222-8333-000000000001",
  "service_name": "Corte de cabello",
  "duration_label": "60 min",
  "date": "2026-11-21",
  "time": "09:00",
  "end_time": "10:00",
  "status": "confirmada",
  "notes": null
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Campos inválidos o incompletos | `"Faltan datos requeridos de la reserva."` |
| `400` | Fecha u hora ya pasó (hora Colombia) | `"No puedes reservar en una fecha u hora que ya pasó."` |
| `400` | Día cerrado, fuera de horario, desalineado con `slot_minutes` o se cruza con el almuerzo/cierre | `"Ese horario no está disponible. Elige un turno de la lista."` |
| `401` | Sin sesión | `"Debes iniciar sesión para reservar."` |
| `404` | El servicio no existe o está inactivo | `"Este servicio no está disponible."` |
| `409` | El rango `[time, end_time)` se solapa con otra cita no cancelada (error Postgres `23505` o `23P01`) | `"Este bloque horario ya está ocupado. Por favor elige otro turno."` |

---

### `GET /api/appointments/mine`
**Quién:** Usuario con sesión. Devuelve la próxima cita activa (`pendiente` o `confirmada` que aún no haya pasado) y el listado de citas activas del propio usuario.

**`200 OK`:**
```json
{
  "next": {
    "id": "b1c2d3e4-5678-49ab-cdef-1234567890ab",
    "service_id": "5f9a0e10-1111-4222-8333-000000000001",
    "service_name": "Corte de cabello",
    "duration_label": "60 min",
    "date": "2026-11-21",
    "time": "09:00",
    "end_time": "10:00",
    "status": "confirmada",
    "notes": null
  },
  "upcoming": []
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `401` | Sin sesión | `"Inicia sesión para ver tus citas."` |

---

### `GET /api/appointments?date=YYYY-MM-DD`
**Quién:** `admin` y `barbero`. Devuelve la agenda del día (excluyendo citas `cancelada`), ordenada cronológicamente por `time`. Si `client_id` es `NULL` (cliente eliminado), `client_name` es `"Cliente eliminado"`. Para `barbero`, `client_name` se obtiene vía `get_client_names` (solo nombre y apellido, nunca correo ni teléfono).

**`200 OK`:**
```json
[
  {
    "id": "b1c2d3e4-5678-49ab-cdef-1234567890ab",
    "client_id": "a1b2c3d4-e5f6-4789-9012-abcdef123456",
    "client_name": "Mateo Gómez",
    "service_id": "5f9a0e10-1111-4222-8333-000000000001",
    "service_name": "Corte de cabello",
    "duration_label": "60 min",
    "date": "2026-11-21",
    "time": "09:00",
    "end_time": "10:00",
    "status": "confirmada",
    "payment_status": "pendiente",
    "notes": null
  }
]
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Fecha inválida | `"La fecha consultada no es válida."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol `cliente` | `"No tienes permisos para realizar esta acción."` |

---

### `PATCH /api/appointments/:id/status`
**Quién:**
- `cliente`: solo puede pasar a `"cancelada"` una cita propia que esté en `"pendiente"` o `"confirmada"`.
- `barbero`: puede cambiar estado de cualquier cita **que no esté `"completada"`**. No puede revertir una cita ya completada.
- `admin`: puede cambiar a cualquier estado (incluso revertir una `"completada"` o reactivar una `"cancelada"` si el rango sigue libre).

**Efectos en servidor:**
- Al pasar a `"completada"`: congela `gross_amount = service.price`, `reserve_amount = service.reserve_amount`, `payment_status = "pagado"`, `payment_method = "efectivo"`, `paid_at = now()`.
- Al pasar a `"cancelada"`: `payment_status = "anulado"`.
- Si `admin` devuelve una `"completada"` a otro estado activo: limpia cobro, reserva y ajustes (`payment_status = "pendiente"`).

**Entrada (JSON):** `{ "status": "pendiente" | "confirmada" | "en_curso" | "completada" | "cancelada" }`.

**`200 OK`:** devuelve la cita actualizada.

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Estado inválido | `"El estado indicado no es válido."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | `cliente` intenta poner un estado distinto de `"cancelada"`, o `barbero` intenta revertir una cita `"completada"` | `"No tienes permisos para realizar esta acción."` |
| `404` | La cita no existe o no pertenece al cliente (RLS) | `"No se encontró la cita."` |
| `409` | `cliente` intenta cancelar una cita ya completada, cancelada o en curso | `"Esta cita ya no se puede cancelar."` |
| `409` | Reactivar una cita `cancelada` choca con otro turno ocupado | `"Este bloque horario ya está ocupado. Por favor elige otro turno."` |

---

### `PATCH /api/appointments/:id/payment`
**Quién:** Exclusivo `admin`. Ajusta el cobro de una cita ya `completada`.

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `payment_method` | `string` | Obligatorio: `"efectivo" \| "transferencia" \| "tarjeta" \| "nequi_daviplata"` |
| `discount_amount` | `integer` | Obligatorio, entero ≥ 0 |
| `refund_amount` | `integer` | Obligatorio, entero ≥ 0; `discount_amount + refund_amount <= gross_amount` |
| `tip_amount` | `integer` | Opcional (por defecto `0`), entero ≥ 0 (propina aparte) |

**`200 OK`:**
```json
{
  "id": "b1c2d3e4-5678-49ab-cdef-1234567890ab",
  "payment_status": "pagado",
  "payment_method": "nequi_daviplata",
  "gross_amount": 25000,
  "discount_amount": 2000,
  "refund_amount": 0,
  "tip_amount": 3000,
  "net_amount": 23000
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Montos negativos o método inválido | `"El descuento, el reembolso y la propina no pueden ser negativos."` |
| `400` | `discount_amount + refund_amount > gross_amount` | `"El descuento y el reembolso no pueden superar el valor del servicio."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | La cita no existe | `"No se encontró la cita."` |
| `409` | La cita no está en estado `"completada"` | `"Solo se puede ajustar el pago de una cita completada."` |

---

## 5. Usuarios (F4)

### `GET /api/users?page=1&size=6`
**Quién:** Exclusivo `admin`. Listado paginado ordenado por rol (`admin`, `barbero`, `cliente`) y nombre.

**`200 OK`:**
```json
{
  "rows": [
    {
      "id": "a1b2c3d4-e5f6-4789-9012-abcdef123456",
      "first_name": "Mateo",
      "last_name": "Gómez",
      "email": "mateo@ejemplo.com",
      "phone": "+57 3001234567",
      "role": "cliente"
    }
  ],
  "total": 12
}
```

**Errores:** `401` sin sesión · `403` rol distinto de `admin`.

---

### `PUT /api/users/:id`
**Quién:** Exclusivo `admin`. Actualiza datos básicos y rol de un usuario.

**Entrada (JSON):** `{ "first_name", "last_name", "email", "phone", "role" }`.

**`200 OK`:** devuelve el perfil actualizado.

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Falta nombre, correo inválido o rol inválido | `"Nombre y correo son obligatorios."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | Usuario inexistente | `"No se encontró el usuario."` |
| `409` | El `admin` intenta quitarse su propio rol `admin` | `"No puedes quitarte a ti mismo el rol de administrador."` |
| `409` | El correo ya pertenece a otra cuenta | `"Ya existe una cuenta con ese correo."` |

---

### `DELETE /api/users/:id`
**Quién:** Exclusivo `admin`. Invoca la función `delete_user(id)`: cancela primero las citas futuras activas del usuario (liberando los turnos) y luego elimina la cuenta en `auth.users` (y su perfil). Las citas pasadas se conservan con `client_id = NULL` (`ON DELETE SET NULL`).

**`204 No Content`** (sin cuerpo).

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | Usuario inexistente | `"No se encontró el usuario."` |
| `409` | El `admin` intenta eliminarse a sí mismo | `"No puedes eliminar tu propia cuenta."` |

---

## 6. Gastos operativos (F5)

### `POST /api/expenses`
**Quién:** Exclusivo `admin`.

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `date` | `string` | Obligatorio, `"YYYY-MM-DD"` |
| `time` | `string` | Opcional (por defecto `"12:00"`), `"HH:MM"` |
| `category` | `string` | Obligatorio: una de las 8 categorías válidas (incluye `"compra_insumos_productos"`) |
| `concept` | `string` | Obligatorio, 1–200 caracteres |
| `amount` | `integer` | Obligatorio, entero > 0 (COP) |
| `payment_method` | `string` | Opcional (por defecto `"transferencia"`), uno de los 4 métodos válidos |
| `reference` | `string \| null` | Opcional, hasta 120 caracteres |

**`201 Created`:**
```json
{
  "id": "e1f2a3b4-1111-4222-8333-000000000099",
  "date": "2026-11-21",
  "time": "12:00",
  "category": "compra_insumos_productos",
  "concept": "Compra de cuchillas y cera",
  "amount": 45000,
  "payment_method": "efectivo",
  "status": "registrado",
  "reference": "FAC-104",
  "void_reason": null,
  "voided_at": null
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Falta fecha/concepto, monto ≤ 0 o categoría/método inválido | `"Por favor ingresa fecha, concepto y un importe mayor a cero."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |

---

### `PUT /api/expenses/:id`
**Quién:** Exclusivo `admin`. Edita un gasto **registrado** (no anulado).

**Entrada (JSON):** mismos campos y validaciones que `POST /api/expenses`.

**`200 OK`:** devuelve el gasto actualizado.

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Datos inválidos o monto ≤ 0 | `"Por favor ingresa fecha, concepto y un importe mayor a cero."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | El gasto no existe | `"No se encontró el gasto."` |
| `409` | El gasto ya está `anulado` | `"Un gasto anulado no se puede editar."` |

---

### `POST /api/expenses/:id/void`
**Quién:** Exclusivo `admin`. Anula un gasto registrado conservándolo con su motivo y fecha (`status = "anulado"`).

**Entrada (JSON):** `{ "reason": string }` (obligatorio, 1–300 caracteres sin solo espacios).

**`200 OK`:** devuelve el gasto con `status: "anulado"`, `void_reason` y `voided_at`.

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Motivo vacío o > 300 caracteres | `"Escribe el motivo de la anulación."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |
| `404` | El gasto no existe | `"No se encontró el gasto."` |
| `409` | El gasto ya está `anulado` | `"Este gasto ya está anulado."` |

---

### `DELETE /api/expenses/:id`
**Quién:** Exclusivo `admin`. Elimina el gasto definitivamente (datos de prueba o errores evidentes).

**`204 No Content`** (sin cuerpo).

**Errores:** `401` sin sesión · `403` rol distinto de `admin` · `404` `"No se encontró el gasto."`.

---

## 7. Ventas de productos (F5)

### `POST /api/product-sales`
**Quién:** Exclusivo `admin`. Registra una venta de producto (suma a Ingresos y Tu ganancia; no aparta reserva).

**Entrada (JSON):**
| Campo | Tipo | Regla |
|---|---|---|
| `date` | `string` | Obligatorio, `"YYYY-MM-DD"` |
| `time` | `string` | Opcional (por defecto `"12:00"`), `"HH:MM"` |
| `concept` | `string` | Obligatorio, 1–200 caracteres |
| `amount` | `integer` | Obligatorio, entero > 0 (COP) |
| `payment_method` | `string` | Opcional (por defecto `"efectivo"`), uno de los 4 métodos válidos |

**`201 Created`:**
```json
{
  "id": "d4e5f6a7-2222-4333-8444-000000000010",
  "date": "2026-11-21",
  "time": "16:30",
  "concept": "Cera mate 100g",
  "amount": 18000,
  "payment_method": "efectivo",
  "status": "registrado",
  "void_reason": null,
  "voided_at": null
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Falta fecha/concepto, monto ≤ 0 o método inválido | `"Por favor ingresa fecha, producto y un importe mayor a cero."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol distinto de `admin` | `"No tienes permisos para realizar esta acción."` |

---

### `POST /api/product-sales/:id/void`
**Quién:** Exclusivo `admin`. Anula una venta registrada con motivo obligatorio.

**Entrada (JSON):** `{ "reason": string }` (obligatorio, 1–300 caracteres).

**`200 OK`:** devuelve la venta con `status: "anulado"`, `void_reason` y `voided_at`.

**Errores:** `400` `"Escribe el motivo de la anulación."` · `401` · `403` · `404` `"No se encontró la venta."` · `409` `"Esta venta ya está anulada."`.

---

### `DELETE /api/product-sales/:id`
**Quién:** Exclusivo `admin`. Elimina la venta definitivamente.

**`204 No Content`** (sin cuerpo).

**Errores:** `401` · `403` · `404` `"No se encontró la venta."`.

---

## 8. Contabilidad y cierre de caja (F5)

### `GET /api/accounting/profit-report`
**Quién:** Exclusivo `admin`. Calcula el reporte financiero con el modelo de reserva fija y lista citas cobradas, ventas de productos y gastos del periodo. Con `?format=csv` descarga el archivo `.csv` en UTF-8 con BOM y celdas saneadas contra inyección de fórmulas (`=`, `+`, `-`, `@`).

**Parámetros query:** `quick_period` (`"today" | "this_week" | "this_month" | "last_month" | "custom"`), `start_date`, `end_date` (rango máximo 366 días), `page` (≥ 1), `page_size` (1–100), `format` (`"json" | "csv"`).

**`200 OK` (JSON):**
```json
{
  "period": { "start_date": "2026-11-01", "end_date": "2026-11-30", "currency": "COP" },
  "summary": {
    "income": 43000,
    "product_sales": 18000,
    "business_reserve": 5000,
    "your_profit": 38000,
    "expenses": 12000,
    "reserve_balance": -7000,
    "services_count": 1,
    "average_ticket": 25000,
    "tips": 2000
  },
  "transactions": {
    "rows": [],
    "total": 3,
    "page": 1,
    "total_pages": 1
  }
}
```

**Errores:**
| Código | Cuándo | Mensaje al usuario |
|---|---|---|
| `400` | Fechas inválidas, `start_date > end_date` o rango > 366 días | `"El rango de fechas no es válido."` |
| `401` | Sin sesión | `"Inicia sesión para continuar."` |
| `403` | Rol `barbero` o `cliente` | `"No tienes permisos para realizar esta acción."` |

---

### `GET /api/accounting/cash-closing?date=YYYY-MM-DD`
**Quién:** Exclusivo `admin`. Calcula el cierre de caja de un día (por defecto hoy en `America/Bogota`) desglosado por los 4 métodos de pago y el **efectivo esperado en caja** (`ingresos efectivo + propinas efectivo − gastos efectivo`).

**`200 OK`:**
```json
{
  "date": "2026-11-21",
  "methods": [
    { "payment_method": "efectivo", "income": 25000, "tips": 0, "expenses": 5000, "balance": 20000 },
    { "payment_method": "nequi_daviplata", "income": 20000, "tips": 0, "expenses": 0, "balance": 20000 },
    { "payment_method": "transferencia", "income": 0, "tips": 0, "expenses": 0, "balance": 0 },
    { "payment_method": "tarjeta", "income": 0, "tips": 0, "expenses": 0, "balance": 0 }
  ],
  "totals": { "income": 45000, "tips": 0, "expenses": 5000 },
  "expected_cash": 20000
}
```

**Errores:** `400` `"La fecha consultada no es válida."` · `401` · `403`.

---

## 9. Funciones SQL controladas (`security definer`)
Necesarias para cumplir las reglas de acceso con RLS activo sin exponer tablas restringidas:

| Función | Quién puede ejecutarla | Qué hace |
|---|---|---|
| `get_my_role()` / `is_admin()` | `authenticated` | Lee el rol actual desde `profiles` sin disparar recursión RLS (`42P17`) |
| `get_booked_ranges(p_date)` | `authenticated` | Devuelve `(start_time, end_time)` de citas no canceladas de esa fecha, sin datos personales |
| `get_client_names(p_ids)` | `authenticated` (solo si rol es `admin` o `barbero`) | Devuelve `(id, first_name, last_name)` sin correo ni teléfono para la agenda del barbero |
| `delete_user(p_user_id)` | `authenticated` (solo si `is_admin()` y `p_user_id <> auth.uid()`) | Cancela citas futuras activas del usuario y lo elimina de `auth.users` (las citas pasadas conservan `client_id = NULL`) |
