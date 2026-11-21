-- =====================================================================
-- Consultas de verificación y datos de prueba · JM Barber Studio (U4)
-- Ejecutar en el SQL Editor de Supabase (proyecto de DESARROLLO)
-- después de aplicar supabase/migrations/20261120000000_esquema_mvp.sql
-- =====================================================================

-- 1) Comprobar datos semilla (horario y 6 servicios con reserva y duración)
select * from public.business_hours;
select name, price, reserve_amount, duration_minutes, is_active
from public.services
order by sort_order;

-- 2) Comprobar que las 6 tablas tienen RLS activo (rowsecurity = true)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'services', 'business_hours', 'appointments', 'expenses', 'product_sales')
order by tablename;

-- 3) Pruebas de reglas de negocio en transacción revertida (no ensucian la BD):
--    a) Reserva mayor que precio debe fallar (CHECK)
--    b) Cita solapada (09:00-10:00 vs 09:30-10:00) debe fallar (EXCLUDE 23P01)
--    c) Gasto anulado sin motivo debe fallar (CHECK)
begin;
  -- (a) Debe fallar por CHECK reserve_amount <= price
  -- insert into public.services (name, short_name, description, price, reserve_amount, duration_label, duration_minutes)
  -- values ('Prueba', 'Prueba', 'Demo', 10000, 15000, '30 min', 30);

  -- (b) Dos citas solapadas el mismo día: la segunda DEBE fallar con 23P01
  insert into public.appointments (client_id, service_id, date, time, end_time, status)
  select null, id, '2099-01-10', '09:00', '10:00', 'confirmada'
  from public.services order by sort_order limit 1;

  -- Descomenta la siguiente sentencia para comprobar que Postgres rechaza el cruce:
  -- insert into public.appointments (client_id, service_id, date, time, end_time, status)
  -- select null, id, '2099-01-10', '09:30', '10:00', 'confirmada'
  -- from public.services order by sort_order limit 1;

  -- (c) Gasto anulado sin motivo: descomenta para comprobar que falla por CHECK
  -- insert into public.expenses (date, category, concept, amount, status)
  -- values ('2099-01-10', 'otros', 'Prueba', 5000, 'anulado');
rollback;
