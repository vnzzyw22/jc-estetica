-- Jennifer Camila — schema inicial.
-- Um profissional por deployment: sem business_id. Dados da marca vivem em
-- `settings` (linha única) e `site_content` (chave/valor), nunca no código.

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_profiles — quem é administrador. Criar o usuário em Authentication e
-- inserir o user_id aqui (ver README). Ter conta no Auth NÃO basta para ser admin.
-- ---------------------------------------------------------------------------
create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles where user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- settings — linha única
-- ---------------------------------------------------------------------------
create table public.settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  business_name text not null default 'Jennifer Camila',
  business_tagline text not null default 'Estética facial e corporal',
  whatsapp text,
  instagram text,
  email text,
  address text,
  city text,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  min_notice_hours integer not null default 2 check (min_notice_hours >= 0),
  max_days_ahead integer not null default 60 check (max_days_ahead between 1 and 365),
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  auto_confirm boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = '00000000-0000-0000-0000-000000000001')
);

create trigger set_updated_at before update on public.settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- availability — expediente semanal (0 = domingo … 6 = sábado)
-- ---------------------------------------------------------------------------
create table public.availability (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default false,
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  constraint availability_hours check (
    not is_open or (open_time is not null and close_time is not null and close_time > open_time)
  ),
  constraint availability_break check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_end > break_start)
  )
);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'facial' check (category in ('facial', 'corporal', 'tratamentos', 'protocolos')),
  description text,
  indication text,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10, 2) check (price is null or price >= 0),
  image_url text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.services
for each row execute function public.set_updated_at();
create index services_listing_idx on public.services (active, category, display_order);

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique, -- somente dígitos, com DDD
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.clients
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- appointments — conflito impedido pelo banco (EXCLUDE), não só pela aplicação
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  source text not null default 'site' check (source in ('site', 'admin')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (ends_at > starts_at)
);

create trigger set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create index appointments_client_idx on public.appointments (client_id);
create index appointments_starts_idx on public.appointments (starts_at);

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status <> 'cancelled');

-- ---------------------------------------------------------------------------
-- blocked_slots — bloqueios pontuais, períodos, dia inteiro, férias, feriados
-- ---------------------------------------------------------------------------
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'block' check (kind in ('block', 'day_off', 'vacation', 'holiday', 'personal')),
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_valid_range check (ends_at > starts_at)
);

create index blocked_slots_starts_idx on public.blocked_slots (starts_at);

-- ---------------------------------------------------------------------------
-- gallery, faq, site_content
-- ---------------------------------------------------------------------------
create table public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title text,
  category text not null default 'facial' check (category in ('facial', 'corporal', 'espaco', 'profissional')),
  display_order integer not null default 0,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.gallery
for each row execute function public.set_updated_at();
create index gallery_listing_idx on public.gallery (active, display_order);

create table public.faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.faq
for each row execute function public.set_updated_at();

create table public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.site_content
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- busy_slots — só intervalos ocupados (sem PII) para o site calcular horários.
-- A view roda com privilégios do dono, então ignora a RLS das tabelas de origem
-- apenas para estas duas colunas.
-- ---------------------------------------------------------------------------
create view public.busy_slots as
select starts_at, ends_at from public.appointments where status <> 'cancelled'
union all
select starts_at, ends_at from public.blocked_slots;

grant select on public.busy_slots to anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_booking — único caminho de escrita do público. Valida serviço ativo,
-- antecedência, expediente, pausa e bloqueios; faz upsert do cliente por
-- telefone; insere o agendamento (o EXCLUDE barra conflito, código 23P01).
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_settings public.settings;
  v_avail public.availability;
  v_ends timestamptz;
  v_client uuid;
  v_appt uuid;
  v_local_start timestamp;
  v_local_end timestamp;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  select * into v_service from public.services where id = p_service_id and active;
  if not found then raise exception 'service_not_found' using errcode = 'P0001'; end if;

  select * into v_settings from public.settings limit 1;

  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then raise exception 'invalid_phone' using errcode = 'P0001'; end if;

  v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes);

  if p_starts_at < now() + make_interval(hours => v_settings.min_notice_hours) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  if p_starts_at > now() + make_interval(days => v_settings.max_days_ahead) then
    raise exception 'too_far' using errcode = 'P0001';
  end if;

  v_local_start := p_starts_at at time zone v_settings.timezone;
  v_local_end := v_ends at time zone v_settings.timezone;

  select * into v_avail from public.availability
  where weekday = extract(dow from v_local_start)::int;

  if not found or not v_avail.is_open
     or v_local_start::date <> v_local_end::date
     or v_local_start::time < v_avail.open_time
     or v_local_end::time > v_avail.close_time then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if v_avail.break_start is not null
     and v_local_start::time < v_avail.break_end
     and v_local_end::time > v_avail.break_start then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.blocked_slots
    where tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, v_ends, '[)')
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  insert into public.clients (name, phone, email)
  values (trim(p_name), v_phone, nullif(trim(coalesce(p_email, '')), ''))
  on conflict (phone) do update
    set name = excluded.name,
        email = coalesce(excluded.email, public.clients.email)
  returning id into v_client;

  insert into public.appointments (client_id, service_id, starts_at, ends_at, status, source, notes)
  values (
    v_client, v_service.id, p_starts_at, v_ends,
    case when v_settings.auto_confirm then 'confirmed' else 'pending' end,
    'site', nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_appt;

  return v_appt;
end;
$$;

grant execute on function public.create_booking(uuid, timestamptz, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;
alter table public.settings enable row level security;
alter table public.availability enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.gallery enable row level security;
alter table public.faq enable row level security;
alter table public.site_content enable row level security;

create policy admin_profiles_self_read on public.admin_profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- Conteúdo público (somente leitura para anon)
create policy settings_public_read on public.settings for select to anon, authenticated using (true);
create policy availability_public_read on public.availability for select to anon, authenticated using (true);
create policy site_content_public_read on public.site_content for select to anon, authenticated using (true);
create policy services_public_read on public.services for select to anon, authenticated using (active);
create policy gallery_public_read on public.gallery for select to anon, authenticated using (active);
create policy faq_public_read on public.faq for select to anon, authenticated using (active);

-- Administração completa: só quem está em admin_profiles
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy availability_admin on public.availability for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy site_content_admin on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy services_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy gallery_admin on public.gallery for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy faq_admin on public.faq for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clients_admin on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy appointments_admin on public.appointments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy blocked_slots_admin on public.blocked_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage — bucket público "media" (leitura aberta, escrita só admin)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy media_public_read on storage.objects
  for select to public using (bucket_id = 'media');
create policy media_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy media_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
