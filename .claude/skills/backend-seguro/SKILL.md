---
name: backend-seguro
description: Úsala siempre que crees o modifiques tablas, migraciones, políticas RLS,
  Route Handlers, Server Actions o cualquier código que lea o escriba datos.
---

# Backend seguro (Supabase + Next.js · JM Barber Studio)

## Antes de escribir código
1. Lee `docs/datos/modelo.md` y `docs/contratos/api.md`.
   Si la operación no está en el contrato, detente y propón primero el cambio al contrato.

## Base de datos
- Todo cambio de esquema va en una migración versionada en `supabase/migrations/`. Nunca SQL suelto.
- RLS activado en TODAS las tablas. Una política explícita por operación (`select` / `insert` / `update` / `delete`).
- Las políticas leen el rol mediante `get_my_role()` / `is_admin()` (`security definer`), nunca con subconsultas directas a `profiles` (evita recursión `42P17`).
- Reglas de negocio críticas como restricciones en BD: `UNIQUE`, `EXCLUDE` (no solapamiento), `CHECK`, `FOREIGN KEY`.
- Nunca usar `using (true)` sobre datos personales (`profiles`, `appointments`, `expenses`, `product_sales`).
- Si "no aparecen datos", revisa las políticas RLS. Nunca desactives RLS ni uses `service_role` para saltarlo.

## Servidor
- Valida toda entrada con Zod antes de tocar la base de datos.
- El usuario sale siempre de `supabase.auth.getUser()` y su rol de `profiles` (`get_my_role()`), nunca del cuerpo, de la URL ni de `user_metadata`.
- Dueño (`client_id`), fin de turno (`end_time`), precio (`gross_amount`), reserva (`reserve_amount`) y estado los decide el servidor, nunca el navegador.
- Respuestas y códigos HTTP (`400`, `401`, `403`, `404`, `409`) exactamente como dice `docs/contratos/api.md`.
- Errores de unicidad o solapamiento de Postgres (`23505` / `23P01`) → `409` con el mensaje del contrato.
- Al cliente nunca le llegan mensajes internos de Postgres, nombres de tablas ni trazas: esos detalles solo van al log del servidor.
- Nada de SQL armado concatenando texto del usuario (usar siempre el cliente de Supabase o consultas parametrizadas).
- En escrituras con Supabase, revisar siempre `error` y filas afectadas antes de confirmar éxito.

## Secretos
- Solo `NEXT_PUBLIC_SUPABASE_URL` y la clave publicable (`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) llevan prefijo `NEXT_PUBLIC_`.
- La clave secreta (`service_role` / `sb_secret_...`) nunca va en código del cliente ni con prefijo `NEXT_PUBLIC_`; solo en el servidor y solo si es indispensable.
- `.env.local` siempre en `.gitignore`; las variables requeridas se documentan sin valores en `.env.local.example`.

## Al terminar
- Lista qué criterios de aceptación de `docs/specs/` cubre el cambio y cómo probar cada uno,
  incluido al menos un caso de error, también por fuera del formulario.
