# Guía para terminar el backend · JM Barber Studio

Pasos ordenados **de lo más importante a lo menos importante**. Haz uno a la vez: al terminarlo, comprueba su "Listo cuando", marca la tarea en `docs/tareas.md`, haz commit y pasa al siguiente.

- **Contrato de cada operación:** `docs/contratos/api.md`
- **Criterios que se verifican:** los marcados **[Back]** en `docs/specs/F1..F5`
- **Leyenda:** 🔴 bloqueante · 🟠 datos y seguridad · 🟡 publicación · 🟢 mejora menor

---

## 🔴 Prioridad 1 · Sin esto el backend no funciona

### Paso 1 · Corregir las reglas de acceso (RLS) del esquema · tarea 3.10
- **Por qué:** las políticas consultan `profiles` desde dentro de `profiles`. Postgres responde con "infinite recursion" (`42P17`) y fallarían casi todas las consultas, incluida la portada.
- **Qué se hace:** en `supabase/schema.sql`, crear `is_admin()` y `get_my_role()` (`security definer`, `stable`) y reescribir todas las políticas para usarlas.
- **Quién:** el agente (solo el archivo SQL).
- **Listo cuando:** ninguna política de `schema.sql` contiene `select role from public.profiles`.

### Paso 2 · Crear el proyecto en Supabase · tarea 3.1
- **Por qué:** es la base de datos y el login reales.
- **Qué se hace:** crear el proyecto `jm-barber-studio` en la región `sa-east-1` (São Paulo), plan gratuito. **Hecho:** se reactivó el proyecto existente "Barberia JM" (`us-west-2`).
- **Quién:** el agente con el conector MCP de Supabase, **con tu aprobación del costo ($0 en plan gratis)**.
- **Listo cuando:** el proyecto aparece "Active" en supabase.com.

### Paso 3 · Aplicar el esquema · tarea 3.2
- **Qué se hace:** ejecutar `supabase/schema.sql` (ya corregido) en el proyecto.
- **Quién:** el agente con el conector MCP.
- **Listo cuando:** en Table Editor están `profiles`, `services`, `business_hours`, `appointments` y `expenses`, todas con RLS activo, y hay servicios y horario semilla.

### Paso 4 · Conectar la app en local y configurar Auth · tareas 3.1 (llaves) y 3.3
- **Qué se hace:**
  1. Copiar la URL y la anon key del proyecto en `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Nunca en el código.
  2. En Supabase → Authentication: activar correo/contraseña, **desactivar "Confirm email"**, `Site URL` = `https://jm-barber-studio-delta.vercel.app` y agregar `http://localhost:3000` en Redirect URLs.
- **Quién:** **tú** en el panel de Supabase (el agente te guía).
- **Listo cuando:** con `npm run dev`, la portada `/` muestra los servicios leídos desde Supabase.

### Paso 5 · Crear la cuenta de administrador · tarea 3.7
- **Qué se hace:** registrarte en `/registro` y promover tu cuenta con `update profiles set role = 'admin' where email = '...'`.
- **Quién:** tú te registras; el agente ejecuta el `update`.
- **Listo cuando:** al iniciar sesión entras a `/admin`.
- **Hecho:** cuenta admin creada. Para lograrlo se corrigió `proxy.ts` (tarea 3.15), que leía el rol de un dato editable por el usuario.

---

## 🟠 Prioridad 2 · Datos correctos y seguridad

### Paso 5b · Usar solo datos de Supabase cuando está conectado · tarea 3.16
- **Por qué:** con Supabase conectado, la app todavía mezcla datos de ejemplo y de memoria: `/admin` muestra 4 citas que no existen en la base y `/cliente` busca citas con un id local (`usr-…`) en vez del `uuid` de Supabase. Sin esto, ningún criterio [Back] se puede verificar con confianza.
- **Qué se hace:** en `lib/data/queries.ts` y `lib/actions.ts`, cuando `isSupabaseConfigured()` es verdadero, leer y escribir solo en Supabase y tomar el usuario de la sesión de Supabase. El modo demo queda igual.
- **Quién:** el agente.
- **Listo cuando:** con la base vacía de citas, `/admin` muestra 0 citas y `/cliente` no muestra errores en la consola.

### Paso 6 · Impedir dos citas en el mismo turno · tareas 3.4, 3.5 y 3.6
- **Por qué:** hoy el control de cruces solo revisa la memoria del servidor y la tabla no lo impide. Además, con RLS cada cliente solo ve sus citas, así que no sabe qué turnos tomaron otros.
- **Qué se hace:**
  1. Índice único parcial en `appointments (date, time)` donde `status <> 'cancelada'`.
  2. Función `get_booked_slots(date)` que devuelve solo las horas ocupadas.
  3. En el código, usar esa función para la disponibilidad y traducir el error `23505` al mensaje `"Este bloque horario ya está ocupado. Por favor elige otro turno."`.
- **Quién:** el agente (SQL + `lib/data/queries.ts` + `lib/actions.ts`).
- **Listo cuando:** se cumplen los criterios [Back] de **F2** con dos cuentas de cliente en dos navegadores.

### Paso 7 · No decir "guardado" si no se guardó · tarea 3.12
- **Por qué:** las acciones ignoran el `error` de Supabase; la pantalla puede mostrar éxito sin que se haya guardado nada.
- **Qué se hace:** revisar `error` en cada mutación de `lib/actions.ts` y responder `{ ok: false, message }` si falla.
- **Quién:** el agente.
- **Listo cuando:** se cumple el criterio [Back] de errores en **F4**.

### Paso 8 · Validar el rol dentro de cada acción · tarea 3.13
- **Por qué:** las Server Actions se pueden llamar con un POST directo; hoy solo `createExpenseAction` revisa el rol.
- **Qué se hace:** validar en el servidor el rol que indica la columna "Rol" de `docs/contratos/api.md`.
- **Quién:** el agente.
- **Listo cuando:** un `cliente` no puede cambiar horarios, servicios, usuarios ni citas ajenas (criterio [Back] de **F4**).

### Paso 9 · El admin gestiona usuarios · tarea 3.11
- **Por qué:** hoy solo cada usuario puede editar su propio perfil y no hay política de borrado.
- **Qué se hace:** política para que el admin edite cualquier perfil y función `delete_user(id)` (solo admin) que borre de `auth.users`.
- **Quién:** el agente.
- **Listo cuando:** se cumplen los criterios [Back] de usuarios en **F4**.

---

## 🟡 Prioridad 3 · Publicar y comprobar

### Paso 10 · Conectar Supabase en Vercel · tarea 3.8
- **Qué se hace:** agregar las dos variables en Vercel (Production y Preview) y hacer push a `main`.
- **Quién:** el agente con Vercel CLI, o tú en vercel.com → Settings → Environment Variables.
- **Listo cuando:** el despliegue está "Ready" y la URL pública lee los datos de Supabase.

### Paso 11 · Verificar todos los criterios [Back] · tarea 3.9
- **Qué se hace:** recorrer en https://jm-barber-studio-delta.vercel.app los 17 criterios [Back] de F1–F5 y anotar cumple / no cumple en `BITACORA_IA.md`.
- **Quién:** juntos.
- **Listo cuando:** todos dicen "cumple" o tienen una tarea nueva para corregirlos.

---

## 🟢 Prioridad 4 · Mejoras menores

### Paso 12 · Renombrar `middleware.ts` a `proxy.ts` · tarea 3.14
- **Por qué:** Next.js 16 cambió la convención; el archivo actual funciona pero está obsoleto.
- **Listo cuando:** sin sesión, `/cliente` y `/admin` siguen redirigiendo a `/login`.

### Paso 13 · Guardar la captura del diseño
- **Qué se hace:** tomar una captura de la portada y guardarla como `docs/diseno/referencias/pantalla-principal.png`.
- **Quién:** tú.

---

## Resumen

| # | Paso | Prioridad | Tareas | Quién |
|---|---|---|---|---|
| 1 | Corregir RLS (recursión) | 🔴 | 3.10 | Agente |
| 2 | Crear proyecto Supabase | 🔴 | 3.1 | Agente + tu OK |
| 3 | Aplicar esquema | 🔴 | 3.2 | Agente |
| 4 | `.env.local` + configurar Auth | 🔴 | 3.1, 3.3 | Tú |
| 5 | Cuenta admin | 🔴 | 3.7 | Tú + agente |
| 6 | Un turno, una cita | 🟠 | 3.4, 3.5, 3.6 | Agente |
| 7 | Manejar errores de Supabase | 🟠 | 3.12 | Agente |
| 8 | Validar rol en acciones | 🟠 | 3.13 | Agente |
| 9 | Admin gestiona usuarios | 🟠 | 3.11 | Agente |
| 10 | Variables en Vercel | 🟡 | 3.8 | Agente o tú |
| 11 | Verificar criterios [Back] | 🟡 | 3.9 | Juntos |
| 12 | `middleware.ts` → `proxy.ts` | 🟢 | 3.14 | Agente |
| 13 | Captura del diseño | 🟢 | — | Tú |
