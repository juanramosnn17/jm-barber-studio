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

-- Políticas de profiles
create policy "Los usuarios pueden ver su propio perfil o administradores ver todos"
  on public.profiles for select
  using (auth.uid() = id or (select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Los usuarios pueden editar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. TABLA: services (Catálogo de servicios de la barbería)
create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  short_name text not null,
  description text not null,
  includes text,
  price numeric(10,2) not null,
  duration_label text not null,
  duration_minutes integer not null default 30,
  image_url text,
  icon text not null default 'content_cut',
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.services enable row level security;

create policy "Cualquiera puede ver servicios activos"
  on public.services for select
  using (is_active = true or (select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Solo administradores pueden crear o modificar servicios"
  on public.services for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

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

create policy "Cualquiera puede consultar el horario de atención"
  on public.business_hours for select
  using (true);

create policy "Solo administradores pueden actualizar el horario"
  on public.business_hours for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- 4. TABLA: appointments (Citas y reservaciones)
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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.appointments enable row level security;

create policy "Los clientes ven sus citas y los administradores ven todas"
  on public.appointments for select
  using (auth.uid() = client_id or (select role from public.profiles where id = auth.uid()) in ('admin', 'barbero'));

create policy "Los clientes autenticados pueden crear citas para sí mismos"
  on public.appointments for insert
  with check (auth.uid() = client_id);

create policy "Los clientes pueden cancelar sus citas y los administradores actualizarlas"
  on public.appointments for update
  using (auth.uid() = client_id or (select role from public.profiles where id = auth.uid()) in ('admin', 'barbero'));

-- 5. TRIGGER: Creación automática de perfil al registrarse en Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, role, reminders_opt_in)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    coalesce((new.raw_user_meta_data->>'reminders_opt_in')::boolean, true)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. DATOS INICIALES SEMILLA (Servicios y Horarios por defecto)
insert into public.business_hours (id, open_days, open_time, close_time, break_start, break_end, slot_minutes, barbers_count)
values (1, '{1,2,3,4,5,6}', '09:00', '20:00', '14:00', '15:00', 30, 2)
on conflict (id) do nothing;

insert into public.services (name, short_name, description, includes, price, duration_label, duration_minutes, image_url, icon, is_active, sort_order)
values
  ('Corte de cabello', 'Corte de cabello', 'Corte técnico personalizado a tijera y máquina según morfología facial, incluye lavado revitalizante, tónico de cuero cabelludo y peinado final.', 'Lavado + Peinado + Asesoría rápida', 25000, '35-40 min', 40, '/images/servicios/corte-cabello.jpg', 'content_cut', true, 1),
  ('Arreglo de barba', 'Corte de barba', 'Perfilado milimétrico con navaja clásica, tratamiento con toallas calientes aromáticas e hidratación intensiva con aceites orgánicos.', 'Toalla caliente + Aceites esenciales', 18000, '25-30 min', 30, '/images/servicios/arreglo-barba.jpg', 'face', true, 2),
  ('Arreglo de cejas', 'Arreglo de cejas', 'Diseño, definición y limpieza de cejas respetando la armonía de la mirada mediante técnica combinada de navaja y tijera de precisión.', 'Perfilado con navaja + Fijación', 10000, '15 min', 15, '/images/servicios/arreglo-cejas.jpg', 'brush', true, 3),
  ('Corte Pro (Cabello + Barba)', 'Corte Pro', 'Servicio combinado de corte técnico integral a tijera y máquina con perfilado y ritual de toalla caliente para barba.', 'Cabello + Barba completa + Toalla caliente', 38000, '50-60 min', 60, '/images/servicios/corte-pro.jpg', 'stars', true, 4),
  ('Corte Pro Max (Cabello + Barba + Cejas)', 'Corte Pro Max', 'Experiencia total de cuidado facial y capilar: corte completo, diseño integral de barba con toalla caliente infusionada y limpieza precisa de cejas.', 'Cabello + Barba + Cejas + Toalla aromática', 45000, '65-75 min', 75, '/images/servicios/corte-pro-max.jpg', 'workspace_premium', true, 5),
  ('Corte Ultra Pro Max', 'Corte Ultra Pro Max', 'El ritual insignia definitivo: corte morfológico a medida, barba con doble toalla y vapor, cejas, más asesoría personalizada de imagen y estilismo exclusivo.', 'Corte + Barba + Cejas + Asesoría de Imagen', 60000, '80-90 min', 90, '/images/servicios/arreglo-cejas.jpg', 'diamond', true, 6)
on conflict do nothing;
