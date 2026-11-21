-- =====================================================================
-- Migración inicial del MVP · JM Barber Studio (Unidad 4)
-- Fuente de verdad: docs/datos/modelo.md + docs/contratos/api.md
-- Skill aplicada: .claude/skills/backend-seguro/SKILL.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLA: profiles (dueño de fila: el propio usuario, id = auth.uid())
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null default '',
  email text not null check (length(trim(email)) > 0),
  phone text,
  role text not null default 'cliente'
    check (role in ('cliente', 'barbero', 'admin')),
  created_at timestamptz not null default now()
);

create unique index profiles_email_lower_uk
  on public.profiles (lower(email));

-- Funciones de rol (evitan recursión RLS 42P17 sobre profiles)
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

revoke execute on function public.get_my_role() from public;
grant execute on function public.get_my_role() to anon, authenticated;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Perfil automático al registrarse en Supabase Auth (rol SIEMPRE 'cliente')
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), 'Usuario'),
    coalesce(trim(new.raw_user_meta_data->>'last_name'), ''),
    lower(trim(new.email)),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    'cliente'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nombres de clientes para la agenda (solo admin/barbero; sin correo ni teléfono)
create or replace function public.get_client_names(p_ids uuid[])
returns table (id uuid, first_name text, last_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.first_name, p.last_name
  from public.profiles p
  where p.id = any(p_ids)
    and public.get_my_role() in ('admin', 'barbero');
$$;

revoke execute on function public.get_client_names(uuid[]) from public, anon;
grant execute on function public.get_client_names(uuid[]) to authenticated;

-- RLS de profiles (una política por operación)
alter table public.profiles enable row level security;

create policy "profiles: ver propio o admin todos"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: editar propio sin cambiar rol"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.get_my_role());

create policy "profiles: admin edita cualquiera sin quitarse rol admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin() and (id <> auth.uid() or role = 'admin'));

-- ---------------------------------------------------------------------
-- 2. TABLA: services (dueño: negocio / admin)
-- ---------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  short_name text not null check (length(trim(short_name)) > 0),
  description text not null,
  includes text,
  price integer not null check (price > 0),
  reserve_amount integer not null default 0
    check (reserve_amount >= 0 and reserve_amount <= price),
  duration_label text not null check (length(trim(duration_label)) > 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  image_url text,
  icon text not null default 'content_cut',
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

alter table public.services enable row level security;

create policy "services: activos públicos o admin todos"
  on public.services for select
  using (is_active = true or public.is_admin());

create policy "services: solo admin crea"
  on public.services for insert
  with check (public.is_admin());

create policy "services: solo admin edita"
  on public.services for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. TABLA: business_hours (fila única id = 1; dueño: negocio / admin)
-- ---------------------------------------------------------------------
create table public.business_hours (
  id smallint primary key default 1 check (id = 1),
  open_days smallint[] not null default '{1,2,3,4,5,6}'
    check (
      cardinality(open_days) >= 1
      and open_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    ),
  open_time time not null default '09:00',
  close_time time not null default '20:00',
  break_start time default '14:00',
  break_end time default '15:00',
  slot_minutes smallint not null default 30 check (slot_minutes > 0),
  created_at timestamptz not null default now(),
  check (open_time < close_time),
  check (
    (break_start is null and break_end is null)
    or (
      break_start is not null
      and break_end is not null
      and open_time <= break_start
      and break_start < break_end
      and break_end <= close_time
    )
  )
);

alter table public.business_hours enable row level security;

create policy "business_hours: lectura pública"
  on public.business_hours for select
  using (true);

create policy "business_hours: solo admin actualiza"
  on public.business_hours for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. TABLA: appointments (dueño de fila: client_id = auth.uid())
-- ---------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles (id) on delete set null,
  service_id uuid not null references public.services (id) on delete restrict,
  date date not null,
  time time not null,
  end_time time not null,
  slot_range tsrange generated always as (
    tsrange(date + time, date + end_time, '[)')
  ) stored,
  status text not null default 'confirmada'
    check (status in ('pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada')),
  notes text,
  payment_status text not null default 'pendiente'
    check (payment_status in ('pendiente', 'pagado', 'reembolsado', 'anulado')),
  payment_method text
    check (payment_method in ('efectivo', 'transferencia', 'tarjeta', 'nequi_daviplata')),
  gross_amount integer check (gross_amount is null or gross_amount > 0),
  reserve_amount integer check (reserve_amount is null or reserve_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  refund_amount integer not null default 0 check (refund_amount >= 0),
  tip_amount integer not null default 0 check (tip_amount >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_time > time),
  check (gross_amount is null or reserve_amount is null or reserve_amount <= gross_amount),
  check (gross_amount is null or (discount_amount + refund_amount) <= gross_amount),
  constraint appointments_no_overlap
    exclude using gist (slot_range with &&)
    where (status <> 'cancelada')
);

create unique index appointments_unique_active_slot
  on public.appointments (date, time)
  where status <> 'cancelada';

create index appointments_date_idx on public.appointments (date);
create index appointments_client_idx on public.appointments (client_id);

-- Guarda de columnas por rol en UPDATE de appointments:
--  - cliente: solo puede cancelar su cita activa (sin tocar fechas ni pagos)
--  - barbero: no puede revertir citas completadas ni ajustar descuentos/reembolsos/propinas
create or replace function public.guard_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  v_role := public.get_my_role();

  if v_role = 'cliente' then
    if old.status not in ('pendiente', 'confirmada')
       or new.status <> 'cancelada'
       or new.payment_status <> 'anulado' then
      raise exception 'Solo puedes cancelar tus citas activas' using errcode = '42501';
    end if;

    if new.client_id is distinct from old.client_id
       or new.service_id is distinct from old.service_id
       or new.date is distinct from old.date
       or new.time is distinct from old.time
       or new.end_time is distinct from old.end_time
       or new.notes is distinct from old.notes
       or new.payment_method is distinct from old.payment_method
       or new.gross_amount is distinct from old.gross_amount
       or new.reserve_amount is distinct from old.reserve_amount
       or new.discount_amount is distinct from old.discount_amount
       or new.refund_amount is distinct from old.refund_amount
       or new.tip_amount is distinct from old.tip_amount
       or new.paid_at is distinct from old.paid_at then
      raise exception 'No tienes permisos para modificar esos campos de la cita' using errcode = '42501';
    end if;
  elsif v_role = 'barbero' then
    if old.status = 'completada' then
      raise exception 'Solo el administrador puede modificar una cita completada' using errcode = '42501';
    end if;
    if new.discount_amount is distinct from old.discount_amount
       or new.refund_amount is distinct from old.refund_amount
       or new.tip_amount is distinct from old.tip_amount then
      raise exception 'Solo el administrador puede ajustar pagos' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_appointment_update() from public, anon, authenticated;

create trigger trg_guard_appointment_update
  before update on public.appointments
  for each row execute function public.guard_appointment_update();

-- Disponibilidad sin datos personales: rangos [start_time, end_time) ocupados
create or replace function public.get_booked_ranges(p_date date)
returns table (start_time text, end_time text)
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(a.time, 'HH24:MI'), to_char(a.end_time, 'HH24:MI')
  from public.appointments a
  where a.date = p_date
    and a.status <> 'cancelada'
  order by a.time;
$$;

revoke execute on function public.get_booked_ranges(date) from public, anon;
grant execute on function public.get_booked_ranges(date) to authenticated;

-- Eliminación segura de usuario (solo admin, nunca a sí mismo):
-- cancela sus citas futuras activas para liberar turnos y luego borra auth.users
-- (las citas históricas se conservan con client_id = NULL)
create or replace function public.delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamp;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar usuarios' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta' using errcode = '42501';
  end if;

  v_now := now() at time zone 'America/Bogota';

  update public.appointments
     set status = 'cancelada',
         payment_status = 'anulado'
   where client_id = p_user_id
     and status in ('pendiente', 'confirmada')
     and (date > v_now::date or (date = v_now::date and time >= v_now::time));

  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.delete_user(uuid) from public, anon;
grant execute on function public.delete_user(uuid) to authenticated;

-- RLS de appointments (una política por operación)
alter table public.appointments enable row level security;

create policy "appointments: cliente ve las suyas, staff ve todas"
  on public.appointments for select
  using (client_id = auth.uid() or public.get_my_role() in ('admin', 'barbero'));

create policy "appointments: autenticado crea solo para sí mismo sin datos de pago"
  on public.appointments for insert
  with check (
    client_id = auth.uid()
    and status in ('pendiente', 'confirmada')
    and payment_status = 'pendiente'
    and payment_method is null
    and gross_amount is null
    and reserve_amount is null
    and discount_amount = 0
    and refund_amount = 0
    and tip_amount = 0
    and paid_at is null
  );

create policy "appointments: cliente solo cancela sus citas activas"
  on public.appointments for update
  using (client_id = auth.uid() and status in ('pendiente', 'confirmada'))
  with check (client_id = auth.uid() and status = 'cancelada' and payment_status = 'anulado');

create policy "appointments: barbero actualiza citas no completadas"
  on public.appointments for update
  using (public.get_my_role() = 'barbero' and status <> 'completada')
  with check (public.get_my_role() = 'barbero');

create policy "appointments: admin actualiza cualquier cita"
  on public.appointments for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. TABLA: expenses (gastos operativos; dueño: negocio / admin)
-- ---------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null default '12:00',
  category text not null check (category in (
    'arriendo',
    'servicios_publicos',
    'nomina_administrativa',
    'insumos_generales',
    'compra_insumos_productos',
    'publicidad',
    'mantenimiento',
    'otros'
  )),
  concept text not null check (length(trim(concept)) > 0),
  amount integer not null check (amount > 0),
  payment_method text not null default 'transferencia'
    check (payment_method in ('efectivo', 'transferencia', 'tarjeta', 'nequi_daviplata')),
  status text not null default 'registrado'
    check (status in ('registrado', 'anulado')),
  reference text,
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'registrado' and void_reason is null and voided_at is null)
    or (
      status = 'anulado'
      and void_reason is not null
      and length(trim(void_reason)) > 0
      and voided_at is not null
    )
  )
);

create index expenses_date_idx on public.expenses (date);

-- Inmutabilidad de registros anulados (aplica a expenses y product_sales)
create or replace function public.guard_voided_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'anulado' then
    raise exception 'Un registro anulado no se puede editar ni volver a anular' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_voided_record() from public, anon, authenticated;

create trigger trg_guard_voided_expense
  before update on public.expenses
  for each row execute function public.guard_voided_record();

alter table public.expenses enable row level security;

create policy "expenses: solo admin lee"
  on public.expenses for select using (public.is_admin());
create policy "expenses: solo admin crea"
  on public.expenses for insert with check (public.is_admin());
create policy "expenses: solo admin actualiza"
  on public.expenses for update using (public.is_admin()) with check (public.is_admin());
create policy "expenses: solo admin elimina"
  on public.expenses for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. TABLA: product_sales (ventas de productos; dueño: negocio / admin)
-- ---------------------------------------------------------------------
create table public.product_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null default '12:00',
  concept text not null check (length(trim(concept)) > 0),
  amount integer not null check (amount > 0),
  payment_method text not null default 'efectivo'
    check (payment_method in ('efectivo', 'transferencia', 'tarjeta', 'nequi_daviplata')),
  status text not null default 'registrado'
    check (status in ('registrado', 'anulado')),
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'registrado' and void_reason is null and voided_at is null)
    or (
      status = 'anulado'
      and void_reason is not null
      and length(trim(void_reason)) > 0
      and voided_at is not null
    )
  )
);

create index product_sales_date_idx on public.product_sales (date);

create trigger trg_guard_voided_product_sale
  before update on public.product_sales
  for each row execute function public.guard_voided_record();

alter table public.product_sales enable row level security;

create policy "product_sales: solo admin lee"
  on public.product_sales for select using (public.is_admin());
create policy "product_sales: solo admin crea"
  on public.product_sales for insert with check (public.is_admin());
create policy "product_sales: solo admin actualiza"
  on public.product_sales for update using (public.is_admin()) with check (public.is_admin());
create policy "product_sales: solo admin elimina"
  on public.product_sales for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. DATOS SEMILLA BASE (horario de atención + catálogo de servicios)
-- ---------------------------------------------------------------------
insert into public.business_hours (id, open_days, open_time, close_time, break_start, break_end, slot_minutes)
values (1, '{1,2,3,4,5,6}', '09:00', '20:00', '14:00', '15:00', 30)
on conflict (id) do nothing;

insert into public.services (name, short_name, description, includes, price, reserve_amount, duration_label, duration_minutes, image_url, icon, is_active, sort_order)
values
  ('Corte de cabello', 'Corte de cabello', 'Corte técnico personalizado a tijera y máquina según morfología facial, incluye lavado revitalizante, tónico de cuero cabelludo y peinado final.', 'Lavado + Peinado + Asesoría rápida', 25000, 5000, '60 min', 60, '/images/servicios/corte-cabello.jpg', 'content_cut', true, 1),
  ('Arreglo de barba', 'Arreglo de barba', 'Perfilado milimétrico con navaja clásica, tratamiento con toallas calientes aromáticas e hidratación intensiva con aceites orgánicos.', 'Toalla caliente + Aceites esenciales', 18000, 3000, '30 min', 30, '/images/servicios/arreglo-barba.jpg', 'face', true, 2),
  ('Arreglo de cejas', 'Arreglo de cejas', 'Diseño, definición y limpieza de cejas respetando la armonía de la mirada mediante técnica combinada de navaja y tijera de precisión.', 'Perfilado con navaja + Fijación', 10000, 2000, '15 min', 15, '/images/servicios/arreglo-cejas.jpg', 'brush', true, 3),
  ('Corte Pro (Cabello + Barba)', 'Corte Pro', 'Servicio combinado de corte técnico integral a tijera y máquina con perfilado y ritual de toalla caliente para barba.', 'Cabello + Barba completa + Toalla caliente', 38000, 8000, '60 min', 60, '/images/servicios/corte-pro.jpg', 'stars', true, 4),
  ('Corte Pro Max (Cabello + Barba + Cejas)', 'Corte Pro Max', 'Experiencia total de cuidado facial y capilar: corte completo, diseño integral de barba con toalla caliente infusionada y limpieza precisa de cejas.', 'Cabello + Barba + Cejas + Toalla aromática', 45000, 9000, '75 min', 75, '/images/servicios/corte-pro-max.jpg', 'workspace_premium', true, 5),
  ('Corte Ultra Pro Max', 'Corte Ultra Pro Max', 'El ritual insignia definitivo: corte morfológico a medida, barba con doble toalla y vapor, cejas, más asesoría personalizada de imagen y estilismo exclusivo.', 'Corte + Barba + Cejas + Asesoría de Imagen', 60000, 12000, '90 min', 90, '/images/servicios/arreglo-cejas.jpg', 'diamond', true, 6);
