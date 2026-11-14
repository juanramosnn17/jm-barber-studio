-- =====================================================================
-- ESQUEMA DE BASE DE DATOS Y POLÍTICAS DE SEGURIDAD (RLS)
-- PROYECTO: JM BARBER STUDIO
-- ---------------------------------------------------------------------
-- Copia y ejecuta este script en el SQL Editor de tu consola de Supabase.
-- =====================================================================

-- 1. TABLA: profiles (Perfiles de usuario extendidos)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text not null,
  last_name text not null default '',
  email text not null,
  phone text,
  role text not null check (role in ('cliente', 'barbero', 'admin')) default 'cliente',
  avatar_url text,
  reminders_opt_in boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS en profiles
alter table public.profiles enable row level security;

-- 1.1 FUNCIONES DE ROL (tarea 3.10)
-- Leen el rol del usuario actual con "security definer", es decir, sin
-- pasar por las políticas RLS de profiles. Así ninguna política consulta
-- profiles desde dentro de profiles (evita el error 42P17 de recursión).
-- Nota: se llama get_my_role() porque CURRENT_ROLE es palabra reservada de SQL.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.get_my_role() = 'admin', false);
$$;

-- Políticas de profiles
drop policy if exists "Los usuarios pueden ver su propio perfil o administradores ver todos" on public.profiles;
create policy "Los usuarios pueden ver su propio perfil o administradores ver todos"
  on public.profiles for select
  using (auth.uid() = id or public.get_my_role() in ('admin', 'barbero'));

-- El usuario edita sus datos, pero no puede cambiar su propio rol:
-- el rol nuevo debe ser igual al que ya tenía (get_my_role lee el valor previo).
drop policy if exists "Los usuarios pueden editar su propio perfil" on public.profiles;
create policy "Los usuarios pueden editar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = public.get_my_role());

-- 1.2 GESTIÓN DE USUARIOS POR EL ADMIN (tarea 3.11)
-- El admin puede editar cualquier perfil (datos y rol) desde /admin/usuarios.
drop policy if exists "Administradores pueden editar cualquier perfil" on public.profiles;
create policy "Administradores pueden editar cualquier perfil"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Borrado de usuarios: elimina la cuenta en auth.users (y en cascada su perfil).
-- Solo admin, y nunca su propia cuenta (evita quedarse sin administrador).
-- Nota: appointments.client_id es "on delete cascade", así que también se
-- borran las citas de ese cliente.
create or replace function public.delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar usuarios' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.delete_user(uuid) from public, anon;
grant execute on function public.delete_user(uuid) to authenticated;

-- 2. TABLA: services (Catálogo de servicios de la barbería)
create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  short_name text not null,
  description text not null,
  includes text,
  price numeric(10,2) not null,
  direct_cost numeric(10,2) not null default 0,
  commission_percentage numeric(5,2) not null default 40,
  duration_label text not null,
  duration_minutes integer not null default 30,
  image_url text,
  icon text not null default 'content_cut',
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.services enable row level security;

drop policy if exists "Cualquiera puede ver servicios activos" on public.services;
create policy "Cualquiera puede ver servicios activos"
  on public.services for select
  using (is_active = true or public.is_admin());

drop policy if exists "Solo administradores pueden crear o modificar servicios" on public.services;
create policy "Solo administradores pueden crear o modificar servicios"
  on public.services for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3. TABLA: business_hours (Configuración del horario de atención)
create table if not exists public.business_hours (
  id integer primary key default 1 check (id = 1),
  open_days integer[] not null default '{1,2,3,4,5,6}',
  open_time time not null default '09:00',
  close_time time not null default '20:00',
  break_start time default '14:00',
  break_end time default '15:00',
  slot_minutes integer not null default 30,
  barbers_count integer not null default 2
);

alter table public.business_hours enable row level security;

drop policy if exists "Cualquiera puede consultar el horario de atención" on public.business_hours;
create policy "Cualquiera puede consultar el horario de atención"
  on public.business_hours for select
  using (true);

drop policy if exists "Solo administradores pueden actualizar el horario" on public.business_hours;
create policy "Solo administradores pueden actualizar el horario"
  on public.business_hours for update
  using (public.is_admin())
  with check (public.is_admin());

-- 4. TABLA: appointments (Citas y reservaciones con registro contable de pago)
create table if not exists public.appointments (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete restrict not null,
  barber_name text,
  chair text,
  date date not null,
  time time not null,
  status text not null check (status in ('pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada')) default 'pendiente',
  notes text,
  payment_status text not null check (payment_status in ('pendiente', 'pagado', 'reembolsado', 'anulado')) default 'pendiente',
  payment_method text check (payment_method in ('efectivo', 'transferencia', 'tarjeta', 'nequi_daviplata')),
  gross_amount numeric(10,2),
  discount_amount numeric(10,2) not null default 0,
  refund_amount numeric(10,2) not null default 0,
  tip_amount numeric(10,2) not null default 0,
  direct_cost_amount numeric(10,2),
  commission_amount numeric(10,2),
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.appointments enable row level security;

drop policy if exists "Los clientes ven sus citas y los administradores ven todas" on public.appointments;
create policy "Los clientes ven sus citas y los administradores ven todas"
  on public.appointments for select
  using (auth.uid() = client_id or public.get_my_role() in ('admin', 'barbero'));

drop policy if exists "Los clientes autenticados pueden crear citas para sí mismos" on public.appointments;
create policy "Los clientes autenticados pueden crear citas para sí mismos"
  on public.appointments for insert
  with check (auth.uid() = client_id);

drop policy if exists "Los clientes pueden cancelar sus citas y los administradores actualizarlas" on public.appointments;
create policy "Los clientes pueden cancelar sus citas y los administradores actualizarlas"
  on public.appointments for update
  using (auth.uid() = client_id or public.get_my_role() in ('admin', 'barbero'))
  with check (auth.uid() = client_id or public.get_my_role() in ('admin', 'barbero'));

-- 4.0.1 REGLA DE NEGOCIO (spec F2, tarea 3.4): una sola cita no cancelada por (fecha, hora).
-- La base de datos la hace cumplir; un segundo intento falla con el error 23505.
create unique index if not exists appointments_unique_active_slot
  on public.appointments (date, time)
  where status <> 'cancelada';

-- 4.0.2 DISPONIBILIDAD (tarea 3.5): horas ocupadas de una fecha, sin datos personales.
-- Con RLS cada cliente solo ve sus citas; esta función le permite saber qué
-- turnos tomaron otros clientes sin poder leer sus citas.
create or replace function public.get_booked_slots(p_date date)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct to_char(a.time, 'HH24:MI')
  from public.appointments a
  where a.date = p_date and a.status <> 'cancelada'
  order by 1;
$$;

revoke execute on function public.get_booked_slots(date) from public, anon;
grant execute on function public.get_booked_slots(date) to authenticated;

-- 4.1 TABLA: expenses (Gastos operativos de la barbería — solo administradores)
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  time time not null default '12:00',
  category text not null check (category in ('arriendo', 'servicios_publicos', 'nomina_administrativa', 'insumos_generales', 'publicidad', 'mantenimiento', 'otros')),
  concept text not null,
  amount numeric(10,2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('efectivo', 'transferencia', 'tarjeta', 'nequi_daviplata')) default 'transferencia',
  status text not null check (status in ('registrado', 'anulado')) default 'registrado',
  reference text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.expenses enable row level security;

drop policy if exists "Solo administradores pueden consultar y gestionar gastos operativos" on public.expenses;
create policy "Solo administradores pueden consultar y gestionar gastos operativos"
  on public.expenses for all
  using (public.is_admin())
  with check (public.is_admin());

-- 5. TRIGGER: Creación automática de perfil al registrarse en Auth
-- Todo registro nuevo es 'cliente'. El rol NO se toma de los metadatos que
-- envía el usuario (cualquiera podría pedir 'admin' con la anon key pública);
-- solo un administrador lo cambia después desde /admin/usuarios.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, role, reminders_opt_in)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    'cliente',
    coalesce((new.raw_user_meta_data->>'reminders_opt_in')::boolean, true)
  );
  return new;
end;
$$;

-- Solo el trigger ejecuta esta función; no debe poder llamarse por la API (/rest/v1/rpc).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. DATOS INICIALES SEMILLA (Servicios y Horarios por defecto)
insert into public.business_hours (id, open_days, open_time, close_time, break_start, break_end, slot_minutes, barbers_count)
values (1, '{1,2,3,4,5,6}', '09:00', '20:00', '14:00', '15:00', 30, 2)
on conflict (id) do nothing;

insert into public.services (name, short_name, description, includes, price, direct_cost, commission_percentage, duration_label, duration_minutes, image_url, icon, is_active, sort_order)
values
  ('Corte de cabello', 'Corte de cabello', 'Corte técnico personalizado a tijera y máquina según morfología facial, incluye lavado revitalizante, tónico de cuero cabelludo y peinado final.', 'Lavado + Peinado + Asesoría rápida', 25000, 2500, 40, '35-40 min', 40, '/images/servicios/corte-cabello.jpg', 'content_cut', true, 1),
  ('Arreglo de barba', 'Corte de barba', 'Perfilado milimétrico con navaja clásica, tratamiento con toallas calientes aromáticas e hidratación intensiva con aceites orgánicos.', 'Toalla caliente + Aceites esenciales', 18000, 2000, 40, '25-30 min', 30, '/images/servicios/arreglo-barba.jpg', 'face', true, 2),
  ('Arreglo de cejas', 'Arreglo de cejas', 'Diseño, definición y limpieza de cejas respetando la armonía de la mirada mediante técnica combinada de navaja y tijera de precisión.', 'Perfilado con navaja + Fijación', 10000, 800, 40, '15 min', 15, '/images/servicios/arreglo-cejas.jpg', 'brush', true, 3),
  ('Corte Pro (Cabello + Barba)', 'Corte Pro', 'Servicio combinado de corte técnico integral a tijera y máquina con perfilado y ritual de toalla caliente para barba.', 'Cabello + Barba completa + Toalla caliente', 38000, 4000, 45, '50-60 min', 60, '/images/servicios/corte-pro.jpg', 'stars', true, 4),
  ('Corte Pro Max (Cabello + Barba + Cejas)', 'Corte Pro Max', 'Experiencia total de cuidado facial y capilar: corte completo, diseño integral de barba con toalla caliente infusionada y limpieza precisa de cejas.', 'Cabello + Barba + Cejas + Toalla aromática', 45000, 4800, 45, '65-75 min', 75, '/images/servicios/corte-pro-max.jpg', 'workspace_premium', true, 5),
  ('Corte Ultra Pro Max', 'Corte Ultra Pro Max', 'El ritual insignia definitivo: corte morfológico a medida, barba con doble toalla y vapor, cejas, más asesoría personalizada de imagen y estilismo exclusivo.', 'Corte + Barba + Cejas + Asesoría de Imagen', 60000, 6500, 50, '80-90 min', 90, '/images/servicios/arreglo-cejas.jpg', 'diamond', true, 6)
on conflict do nothing;
