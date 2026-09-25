-- ============================================================================
-- Jennifer Camila — instalação COMPLETA do banco (Supabase).
-- Gerado por `npm run db:bundle` a partir de supabase/migrations + supabase/seed.sql.
-- NÃO edite à mão: edite as migrações e gere de novo.
--
-- Como usar: Supabase → SQL Editor → New query → cole TUDO → Run.
-- Rode UMA vez, num projeto vazio. Não contém dados fictícios nem de clientes.
-- Depois: crie o usuário em Authentication e rode o passo "PÓS-INSTALAÇÃO" abaixo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MIGRAÇÃO: 20260924120000_schema_inicial.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- MIGRAÇÃO: 20260925120000_fundacao_clinica.sql
-- ---------------------------------------------------------------------------
-- Fundação de dados v2: triagem, anamnese, tratamentos, sessões, evolução, financeiro.
--
-- Princípios:
--  * `clients` continua sendo a fonte central da pessoa (nome/telefone/e-mail vivem só ali).
--  * `appointments` continua sendo a única agenda: avaliação, retorno, sessão e serviço avulso
--    são o mesmo registro, diferenciados por `kind`. Não existe segunda tabela de agenda.
--  * `treatment_sessions` só liga uma sessão do tratamento ao seu agendamento.
--  * `payments` liga-se a cliente, tratamento, sessão e agendamento; o caixa é uma VIEW
--    (`cash_flow`) sobre payments + expenses, não um módulo isolado.
--  * Dados sensíveis (triagem, anamnese, evolução, financeiro) só têm política de admin.
--    O público escreve apenas por funções SECURITY DEFINER (`create_booking`, `submit_screening`).
--  * Regras que precisam ser atômicas ficam em funções SQL (testadas em tests/sql).

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Categorias de serviço: as três reais da Jennifer
-- ---------------------------------------------------------------------------
alter table public.services drop constraint if exists services_category_check;
update public.services
set category = case category
  when 'facial' then 'facial_olhar'
  when 'corporal' then 'corporal_modelagem'
  else 'terapias_bem_estar'
end
where category in ('facial', 'corporal', 'tratamentos', 'protocolos');
alter table public.services
  add constraint services_category_check
  check (category in ('facial_olhar', 'corporal_modelagem', 'terapias_bem_estar'));
alter table public.services alter column category set default 'facial_olhar';

-- ---------------------------------------------------------------------------
-- 2. Profissionais (hoje uma; a agenda já nasce por profissional)
-- ---------------------------------------------------------------------------
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.professionals
for each row execute function public.set_updated_at();
create unique index professionals_one_default on public.professionals (is_default) where is_default;

insert into public.professionals (name, is_default) values ('Jennifer Camila', true);

create or replace function public.default_professional_id()
returns uuid language sql stable as $$
  select id from public.professionals where is_default limit 1
$$;

-- ---------------------------------------------------------------------------
-- 3. Configurações novas
-- ---------------------------------------------------------------------------
alter table public.settings
  add column evaluation_duration_minutes integer not null default 60 check (evaluation_duration_minutes > 0);

-- ---------------------------------------------------------------------------
-- 4. Termos de consentimento (o TEXTO oficial entra depois, pelo painel)
-- ---------------------------------------------------------------------------
create table public.consent_terms (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'screening' check (kind in ('screening', 'anamnesis', 'treatment')),
  version text not null,
  body text not null,
  active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index consent_terms_one_active on public.consent_terms (kind) where active;

-- ---------------------------------------------------------------------------
-- 5. Triagens (leads)
-- ---------------------------------------------------------------------------
create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  status text not null default 'new'
    check (status in ('new', 'in_review', 'evaluation_scheduled', 'evaluated', 'treatment_proposed', 'treatment_active', 'closed')),
  source text not null default 'site' check (source in ('instagram', 'site', 'referral', 'whatsapp', 'other')),
  source_detail text,
  interest_area text check (interest_area in ('facial_olhar', 'corporal_modelagem', 'terapias_bem_estar', 'not_sure')),
  goal text,
  complaint text,
  desired_outcome text,
  answers jsonb not null default '{}'::jsonb,
  consent_term_id uuid references public.consent_terms (id),
  consented_at timestamptz,
  status_changed_at timestamptz not null default now(),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screenings_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint screenings_answers_size check (pg_column_size(answers) < 16384),
  constraint screenings_text_size check (
    coalesce(char_length(complaint), 0) <= 2000 and coalesce(char_length(desired_outcome), 0) <= 2000
    and coalesce(char_length(goal), 0) <= 200 and coalesce(char_length(source_detail), 0) <= 200
  )
);
create index screenings_client_idx on public.screenings (client_id);
create index screenings_status_idx on public.screenings (status, created_at desc);
create trigger set_updated_at before update on public.screenings
for each row execute function public.set_updated_at();

create or replace function public.touch_status_changed_at()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then new.status_changed_at = now(); end if;
  return new;
end;
$$;
create trigger screenings_status_changed before update on public.screenings
for each row execute function public.touch_status_changed_at();

-- ---------------------------------------------------------------------------
-- 6. Agenda única: appointments ganha tipo, profissional e origem da triagem
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column kind text not null default 'service' check (kind in ('evaluation', 'return', 'session', 'service', 'other')),
  add column professional_id uuid references public.professionals (id),
  add column screening_id uuid references public.screenings (id) on delete set null;

update public.appointments set professional_id = public.default_professional_id() where professional_id is null;
alter table public.appointments alter column professional_id set not null;
alter table public.appointments alter column professional_id set default public.default_professional_id();

-- Avaliação/retorno não precisam de serviço do catálogo; serviço avulso precisa.
alter table public.appointments alter column service_id drop not null;
alter table public.appointments add constraint appointments_service_required check (kind <> 'service' or service_id is not null);

-- Conflito agora é por profissional (duas profissionais podem atender no mesmo horário).
alter table public.appointments drop constraint appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status <> 'cancelled');

create index appointments_kind_idx on public.appointments (kind);
create index appointments_professional_idx on public.appointments (professional_id, starts_at);

-- Bloqueios: null = vale para todas as profissionais.
alter table public.blocked_slots add column professional_id uuid references public.professionals (id);

-- A view pública continua sem PII; ganha a coluna para o futuro filtro por profissional.
create or replace view public.busy_slots as
select starts_at, ends_at, professional_id from public.appointments where status <> 'cancelled'
union all
select starts_at, ends_at, professional_id from public.blocked_slots;
grant select on public.busy_slots to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Anamnese (a pré-anamnese é a própria triagem, referenciada por screening_id)
-- ---------------------------------------------------------------------------
create table public.anamneses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  screening_id uuid references public.screenings (id) on delete set null,
  professional_id uuid not null default public.default_professional_id() references public.professionals (id),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  assessed_at timestamptz,
  evaluation text,
  relevant_history text,
  contraindications text,
  additional_info text,
  professional_notes text,
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anamneses_data_object check (jsonb_typeof(data) = 'object')
);
create index anamneses_client_idx on public.anamneses (client_id, created_at desc);
create trigger set_updated_at before update on public.anamneses
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Pacotes (catálogo) e serviços incluídos
-- ---------------------------------------------------------------------------
create table public.treatment_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  goal text,
  session_count integer not null check (session_count > 0),
  interval_days integer check (interval_days > 0),
  frequency_note text,
  price numeric(10, 2) check (price is null or price >= 0),
  validity_days integer check (validity_days > 0),
  notes text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.treatment_packages
for each row execute function public.set_updated_at();

create table public.package_services (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.treatment_packages (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  position integer not null default 0,
  unique (package_id, service_id)
);

-- ---------------------------------------------------------------------------
-- 9. Tratamentos (protocolo de uma cliente)
-- ---------------------------------------------------------------------------
create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  package_id uuid references public.treatment_packages (id) on delete set null,
  screening_id uuid references public.screenings (id) on delete set null,
  professional_id uuid not null default public.default_professional_id() references public.professionals (id),
  name text not null,
  goal text,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'paused', 'completed', 'cancelled')),
  total_sessions integer not null check (total_sessions > 0),
  interval_days integer check (interval_days > 0),
  frequency_note text,
  billing_mode text not null default 'package' check (billing_mode in ('package', 'per_session')),
  price_total numeric(10, 2) check (price_total is null or price_total >= 0),
  session_price numeric(10, 2) check (session_price is null or session_price >= 0),
  valid_until date,
  proposed_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index treatments_client_idx on public.treatments (client_id);
create index treatments_status_idx on public.treatments (status);
create trigger set_updated_at before update on public.treatments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. Sessões do tratamento (ligadas à agenda por appointment_id)
-- ---------------------------------------------------------------------------
create table public.treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments (id) on delete cascade,
  number integer not null check (number > 0),
  service_id uuid references public.services (id) on delete set null,
  appointment_id uuid unique references public.appointments (id) on delete set null,
  status text not null default 'unscheduled'
    check (status in ('unscheduled', 'scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
  performed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (treatment_id, number)
);
create trigger set_updated_at before update on public.treatment_sessions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. Evolução (fotos: coluna pronta, upload virá depois em bucket PRIVADO)
-- ---------------------------------------------------------------------------
create table public.evolutions (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments (id) on delete cascade,
  session_id uuid references public.treatment_sessions (id) on delete set null,
  recorded_at timestamptz not null default now(),
  notes text not null,
  photos jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evolutions_photos_array check (jsonb_typeof(photos) = 'array')
);
create index evolutions_treatment_idx on public.evolutions (treatment_id, recorded_at);
create trigger set_updated_at before update on public.evolutions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. Financeiro: pagamentos ligados ao restante; despesas por categoria
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'treatment' check (kind in ('treatment', 'session', 'service', 'other')),
  client_id uuid references public.clients (id) on delete restrict,
  treatment_id uuid references public.treatments (id) on delete restrict,
  session_id uuid references public.treatment_sessions (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  description text,
  amount numeric(10, 2) not null check (amount > 0),
  method text check (method in ('pix', 'cash', 'debit', 'credit', 'transfer', 'other')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  installment_number integer not null default 1 check (installment_number > 0),
  installment_total integer not null default 1 check (installment_total > 0),
  due_date date not null default current_date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_client_required check (kind = 'other' or client_id is not null),
  constraint payments_paid_has_date check (status <> 'paid' or paid_at is not null),
  constraint payments_installment_range check (installment_number <= installment_total)
);
create index payments_client_idx on public.payments (client_id);
create index payments_treatment_idx on public.payments (treatment_id);
create index payments_status_due_idx on public.payments (status, due_date);
-- Uma sessão gera no máximo uma cobrança ativa.
create unique index payments_one_per_session on public.payments (session_id)
  where session_id is not null and status <> 'cancelled';
create trigger set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.payments_set_paid_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'paid' and new.paid_at is null then new.paid_at = now(); end if;
  return new;
end;
$$;
create trigger payments_paid_at before insert or update on public.payments
for each row execute function public.payments_set_paid_at();

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('fixed', 'variable')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories (id) on delete restrict,
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  incurred_on date not null default current_date,
  paid_at timestamptz,
  is_recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_incurred_idx on public.expenses (incurred_on);
create trigger set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 13. Views (security_invoker: respeitam a RLS de quem consulta)
-- ---------------------------------------------------------------------------
create view public.treatment_progress with (security_invoker = true) as
select
  t.id as treatment_id,
  t.total_sessions,
  count(*) filter (where s.status = 'completed')::int as completed,
  count(*) filter (where s.status in ('scheduled', 'confirmed', 'rescheduled'))::int as scheduled,
  count(*) filter (where s.status = 'unscheduled')::int as unscheduled
from public.treatments t
left join public.treatment_sessions s on s.treatment_id = t.id
group by t.id;

-- Caixa: entradas (payments) e saídas (expenses). "realized" = já aconteceu; "expected" = previsto.
create view public.cash_flow with (security_invoker = true) as
select
  'in'::text as direction,
  case when p.status = 'paid' then (p.paid_at at time zone 'America/Sao_Paulo')::date else p.due_date end as occurred_on,
  p.amount,
  case when p.status = 'paid' then 'realized' else 'expected' end as state,
  'payment'::text as source,
  p.id as source_id,
  p.client_id,
  p.treatment_id,
  p.kind::text as category
from public.payments p
where p.status in ('paid', 'pending')
union all
select
  'out',
  case when e.paid_at is not null then (e.paid_at at time zone 'America/Sao_Paulo')::date else e.incurred_on end,
  e.amount,
  case when e.paid_at is not null then 'realized' else 'expected' end,
  'expense',
  e.id,
  null,
  null,
  c.kind::text
from public.expenses e
join public.expense_categories c on c.id = e.category_id;

-- ---------------------------------------------------------------------------
-- 14. Funções: escrita pública controlada
-- ---------------------------------------------------------------------------

-- 14.1 Triagem: único caminho de escrita do público na triagem.
create or replace function public.submit_screening(
  p_name text,
  p_phone text,
  p_email text default null,
  p_source text default 'site',
  p_source_detail text default null,
  p_interest_area text default null,
  p_goal text default null,
  p_complaint text default null,
  p_desired_outcome text default null,
  p_answers jsonb default '{}'::jsonb,
  p_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_client uuid;
  v_term uuid;
  v_id uuid;
  v_source text := case when p_source in ('instagram', 'site', 'referral', 'whatsapp', 'other') then p_source else 'other' end;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if p_consent is not true then raise exception 'consent_required' using errcode = 'P0001'; end if;
  if p_interest_area is not null and p_interest_area not in ('facial_olhar', 'corporal_modelagem', 'terapias_bem_estar', 'not_sure') then
    raise exception 'invalid_interest' using errcode = 'P0001';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) >= 16384 then
    raise exception 'invalid_answers' using errcode = 'P0001';
  end if;

  -- Freio simples contra abuso: no máximo 3 triagens por telefone em 24 h.
  if (select count(*) from public.screenings s join public.clients c on c.id = s.client_id
      where c.phone = v_phone and s.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  -- O nome de um cliente já cadastrado NÃO é sobrescrito por quem só conhece o telefone.
  insert into public.clients (name, phone, email)
  values (trim(p_name), v_phone, nullif(trim(coalesce(p_email, '')), ''))
  on conflict (phone) do update set email = coalesce(public.clients.email, excluded.email)
  returning id into v_client;

  select id into v_term from public.consent_terms where kind = 'screening' and active;

  insert into public.screenings (client_id, source, source_detail, interest_area, goal, complaint, desired_outcome, answers, consent_term_id, consented_at)
  values (v_client, v_source, nullif(trim(coalesce(p_source_detail, '')), ''), p_interest_area, nullif(trim(coalesce(p_goal, '')), ''),
          nullif(trim(coalesce(p_complaint, '')), ''), nullif(trim(coalesce(p_desired_outcome, '')), ''), p_answers, v_term, now())
  returning id into v_id;

  return v_id;
end;
$$;

-- 14.2 create_booking v2: avaliação/retorno sem serviço; não sobrescreve nome de cliente existente.
drop function if exists public.create_booking(uuid, timestamptz, text, text, text, text);

create or replace function public.create_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null,
  p_kind text default 'service'
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
  v_duration integer;
  v_ends timestamptz;
  v_client uuid;
  v_appt uuid;
  v_local_start timestamp;
  v_local_end timestamp;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if p_kind not in ('service', 'evaluation', 'return') then raise exception 'invalid_kind' using errcode = 'P0001'; end if;
  select * into v_settings from public.settings limit 1;

  if p_kind = 'service' then
    select * into v_service from public.services where id = p_service_id and active;
    if not found then raise exception 'service_not_found' using errcode = 'P0001'; end if;
    v_duration := v_service.duration_minutes;
  else
    if p_service_id is not null then
      select * into v_service from public.services where id = p_service_id and active;
      if not found then raise exception 'service_not_found' using errcode = 'P0001'; end if;
      v_duration := v_service.duration_minutes;
    else
      v_duration := v_settings.evaluation_duration_minutes;
    end if;
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then raise exception 'invalid_phone' using errcode = 'P0001'; end if;

  v_ends := p_starts_at + make_interval(mins => v_duration);

  if p_starts_at < now() + make_interval(hours => v_settings.min_notice_hours) then raise exception 'too_soon' using errcode = 'P0001'; end if;
  if p_starts_at > now() + make_interval(days => v_settings.max_days_ahead) then raise exception 'too_far' using errcode = 'P0001'; end if;

  v_local_start := p_starts_at at time zone v_settings.timezone;
  v_local_end := v_ends at time zone v_settings.timezone;

  select * into v_avail from public.availability where weekday = extract(dow from v_local_start)::int;
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
  on conflict (phone) do update set email = coalesce(public.clients.email, excluded.email)
  returning id into v_client;

  insert into public.appointments (client_id, service_id, starts_at, ends_at, status, source, notes, kind)
  values (v_client, p_service_id, p_starts_at, v_ends,
          case when v_settings.auto_confirm then 'confirmed' else 'pending' end,
          'site', nullif(trim(coalesce(p_notes, '')), ''), p_kind)
  returning id into v_appt;

  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Funções internas (administração). SECURITY INVOKER: a RLS decide quem pode.
-- ---------------------------------------------------------------------------

create or replace function public.assert_not_blocked(p_starts timestamptz, p_ends timestamptz)
returns void language plpgsql as $$
begin
  if exists (select 1 from public.blocked_slots where tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts, p_ends, '[)')) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
end;
$$;

-- Cria um tratamento "proposto" copiando o pacote do catálogo.
create or replace function public.create_treatment_from_package(p_client_id uuid, p_package_id uuid, p_screening_id uuid default null)
returns uuid language plpgsql as $$
declare
  v_pkg public.treatment_packages;
  v_id uuid;
begin
  select * into v_pkg from public.treatment_packages where id = p_package_id;
  if not found then raise exception 'package_not_found' using errcode = 'P0001'; end if;

  insert into public.treatments (client_id, package_id, screening_id, name, goal, total_sessions, interval_days, frequency_note,
                                 billing_mode, price_total, valid_until)
  values (p_client_id, v_pkg.id, p_screening_id, v_pkg.name, v_pkg.goal, v_pkg.session_count, v_pkg.interval_days, v_pkg.frequency_note,
          'package', v_pkg.price, case when v_pkg.validity_days is null then null else current_date + v_pkg.validity_days end)
  returning id into v_id;

  if p_screening_id is not null then
    update public.screenings set status = 'treatment_proposed' where id = p_screening_id and status in ('new', 'in_review', 'evaluation_scheduled', 'evaluated');
  end if;
  return v_id;
end;
$$;

-- Fecha o tratamento: ativa e gera as sessões (a agendar). Devolve quantas criou.
create or replace function public.activate_treatment(p_treatment_id uuid)
returns integer language plpgsql as $$
declare
  v_t public.treatments;
  v_services uuid[];
  v_count integer := 0;
  n integer;
begin
  select * into v_t from public.treatments where id = p_treatment_id for update;
  if not found then raise exception 'treatment_not_found' using errcode = 'P0001'; end if;
  if v_t.status not in ('proposed', 'paused') then raise exception 'invalid_status' using errcode = 'P0001'; end if;

  update public.treatments set status = 'active', started_at = coalesce(started_at, now()) where id = v_t.id;

  if not exists (select 1 from public.treatment_sessions where treatment_id = v_t.id) then
    select coalesce(array_agg(service_id order by position, id), '{}') into v_services
    from public.package_services where package_id = v_t.package_id;

    for n in 1..v_t.total_sessions loop
      insert into public.treatment_sessions (treatment_id, number, service_id)
      values (v_t.id, n, case when cardinality(v_services) = 0 then null else v_services[((n - 1) % cardinality(v_services)) + 1] end);
      v_count := v_count + 1;
    end loop;
  end if;

  if v_t.screening_id is not null then
    update public.screenings set status = 'treatment_active' where id = v_t.screening_id;
  end if;
  return v_count;
end;
$$;

-- Parcela o valor do pacote (última parcela absorve os centavos). Devolve nº de parcelas.
create or replace function public.create_payment_plan(p_treatment_id uuid, p_installments integer, p_first_due date, p_method text default null)
returns integer language plpgsql as $$
declare
  v_t public.treatments;
  v_base numeric(10, 2);
  v_amount numeric(10, 2);
  i integer;
begin
  select * into v_t from public.treatments where id = p_treatment_id;
  if not found then raise exception 'treatment_not_found' using errcode = 'P0001'; end if;
  if v_t.price_total is null or v_t.price_total <= 0 then raise exception 'no_price' using errcode = 'P0001'; end if;
  if p_installments < 1 or p_installments > 36 then raise exception 'invalid_installments' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payments where treatment_id = v_t.id and kind = 'treatment' and status in ('pending', 'paid')) then
    raise exception 'plan_exists' using errcode = 'P0001';
  end if;

  v_base := trunc(v_t.price_total / p_installments, 2);
  for i in 1..p_installments loop
    v_amount := case when i = p_installments then v_t.price_total - v_base * (p_installments - 1) else v_base end;
    insert into public.payments (kind, client_id, treatment_id, description, amount, method, installment_number, installment_total, due_date)
    values ('treatment', v_t.client_id, v_t.id, v_t.name, v_amount, p_method, i, p_installments, (p_first_due + make_interval(months => i - 1))::date);
  end loop;
  return p_installments;
end;
$$;

-- Agenda (ou reagenda) uma sessão: cria o appointment kind='session'. Devolve o appointment.
create or replace function public.schedule_session(p_session_id uuid, p_starts_at timestamptz, p_duration_minutes integer default null)
returns uuid language plpgsql as $$
declare
  v_s public.treatment_sessions;
  v_t public.treatments;
  v_duration integer;
  v_ends timestamptz;
  v_appt uuid;
  v_old uuid;
begin
  select * into v_s from public.treatment_sessions where id = p_session_id for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0001'; end if;
  if v_s.status in ('completed', 'cancelled') then raise exception 'session_closed' using errcode = 'P0001'; end if;
  select * into v_t from public.treatments where id = v_s.treatment_id;
  if v_t.status <> 'active' then raise exception 'treatment_not_active' using errcode = 'P0001'; end if;

  v_duration := coalesce(p_duration_minutes, (select duration_minutes from public.services where id = v_s.service_id), 60);
  v_ends := p_starts_at + make_interval(mins => v_duration);
  perform public.assert_not_blocked(p_starts_at, v_ends);

  v_old := v_s.appointment_id;
  -- Libera o horário antigo antes (senão o remarcar para um horário sobreposto conflitaria consigo mesmo).
  if v_old is not null then update public.appointments set status = 'cancelled' where id = v_old; end if;

  insert into public.appointments (client_id, service_id, professional_id, starts_at, ends_at, status, source, kind)
  values (v_t.client_id, v_s.service_id, v_t.professional_id, p_starts_at, v_ends, 'pending', 'admin', 'session')
  returning id into v_appt;

  update public.treatment_sessions
  set appointment_id = v_appt, status = case when v_old is null then 'scheduled' else 'rescheduled' end
  where id = v_s.id;
  return v_appt;
end;
$$;

-- Núcleo da conclusão de sessão (usado pela função e pelo gatilho da agenda).
create or replace function public.finish_session(p_session_id uuid, p_notes text default null)
returns void language plpgsql as $$
declare
  v_s public.treatment_sessions;
  v_t public.treatments;
  v_appt public.appointments;
begin
  select * into v_s from public.treatment_sessions where id = p_session_id for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0001'; end if;
  if v_s.status = 'completed' then return; end if;
  if v_s.status = 'cancelled' then raise exception 'session_closed' using errcode = 'P0001'; end if;
  select * into v_t from public.treatments where id = v_s.treatment_id;

  select * into v_appt from public.appointments where id = v_s.appointment_id;

  update public.treatment_sessions
  set status = 'completed', performed_at = coalesce(v_appt.starts_at, now()), notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = v_s.id;

  if v_appt.id is not null and v_appt.status <> 'completed' then
    update public.appointments set status = 'completed' where id = v_appt.id;
  end if;

  if nullif(trim(coalesce(p_notes, '')), '') is not null then
    insert into public.evolutions (treatment_id, session_id, notes) values (v_t.id, v_s.id, trim(p_notes));
  end if;

  -- Sessão avulsa (cobrança por sessão): a realização gera a cobrança pendente.
  if v_t.billing_mode = 'per_session' and v_t.session_price is not null and v_t.session_price > 0
     and not exists (select 1 from public.payments where session_id = v_s.id and status <> 'cancelled') then
    insert into public.payments (kind, client_id, treatment_id, session_id, appointment_id, description, amount)
    values ('session', v_t.client_id, v_t.id, v_s.id, v_appt.id, v_t.name || ' (sessão ' || v_s.number || ')', v_t.session_price);
  end if;

  -- Última sessão em aberto: o tratamento se encerra.
  if not exists (select 1 from public.treatment_sessions where treatment_id = v_t.id and status in ('unscheduled', 'scheduled', 'confirmed', 'rescheduled')) then
    update public.treatments set status = 'completed', completed_at = now() where id = v_t.id and status = 'active';
  end if;
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_notes text default null)
returns void language plpgsql as $$
begin
  perform public.finish_session(p_session_id, p_notes);
end;
$$;

-- A agenda é a verdade do horário: mudanças de status do appointment refletem na sessão.
create or replace function public.sync_session_from_appointment()
returns trigger language plpgsql as $$
declare
  v_s public.treatment_sessions;
begin
  select * into v_s from public.treatment_sessions where appointment_id = new.id;
  if not found then return new; end if;

  if new.status = 'completed' then
    perform public.finish_session(v_s.id, null);
  elsif new.status = 'confirmed' and v_s.status in ('scheduled', 'rescheduled') then
    update public.treatment_sessions set status = 'confirmed' where id = v_s.id;
  elsif new.status = 'pending' and v_s.status = 'confirmed' then
    update public.treatment_sessions set status = 'scheduled' where id = v_s.id;
  elsif new.status = 'cancelled' and v_s.status in ('scheduled', 'confirmed', 'rescheduled') then
    -- Horário liberado: a sessão volta para "a agendar".
    update public.treatment_sessions set status = 'unscheduled', appointment_id = null where id = v_s.id;
  end if;
  return new;
end;
$$;
create trigger appointments_sync_session after update of status on public.appointments
for each row when (old.status is distinct from new.status) execute function public.sync_session_from_appointment();

-- ---------------------------------------------------------------------------
-- 16. Permissões e RLS
-- ---------------------------------------------------------------------------
-- Funções administrativas: só usuários autenticados (e ainda assim a RLS decide).
revoke execute on function public.assert_not_blocked(timestamptz, timestamptz) from public, anon;
revoke execute on function public.create_treatment_from_package(uuid, uuid, uuid) from public, anon;
revoke execute on function public.activate_treatment(uuid) from public, anon;
revoke execute on function public.create_payment_plan(uuid, integer, date, text) from public, anon;
revoke execute on function public.schedule_session(uuid, timestamptz, integer) from public, anon;
revoke execute on function public.finish_session(uuid, text) from public, anon;
revoke execute on function public.complete_session(uuid, text) from public, anon;
grant execute on function public.assert_not_blocked(timestamptz, timestamptz) to authenticated;
grant execute on function public.create_treatment_from_package(uuid, uuid, uuid) to authenticated;
grant execute on function public.activate_treatment(uuid) to authenticated;
grant execute on function public.create_payment_plan(uuid, integer, date, text) to authenticated;
grant execute on function public.schedule_session(uuid, timestamptz, integer) to authenticated;
grant execute on function public.finish_session(uuid, text) to authenticated;
grant execute on function public.complete_session(uuid, text) to authenticated;

-- Escrita pública: somente estas duas funções.
revoke execute on function public.submit_screening(text, text, text, text, text, text, text, text, text, jsonb, boolean) from public;
grant execute on function public.submit_screening(text, text, text, text, text, text, text, text, text, jsonb, boolean) to anon, authenticated;
revoke execute on function public.create_booking(uuid, timestamptz, text, text, text, text, text) from public;
grant execute on function public.create_booking(uuid, timestamptz, text, text, text, text, text) to anon, authenticated;

alter table public.professionals enable row level security;
alter table public.consent_terms enable row level security;
alter table public.screenings enable row level security;
alter table public.anamneses enable row level security;
alter table public.treatment_packages enable row level security;
alter table public.package_services enable row level security;
alter table public.treatments enable row level security;
alter table public.treatment_sessions enable row level security;
alter table public.evolutions enable row level security;
alter table public.payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

-- Público: só o termo de consentimento ATIVO (o formulário precisa exibi-lo) e nomes de profissionais ativos.
create policy consent_terms_public_read on public.consent_terms for select to anon, authenticated using (active);
create policy professionals_public_read on public.professionals for select to anon, authenticated using (active);

create policy professionals_admin on public.professionals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy consent_terms_admin on public.consent_terms for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy screenings_admin on public.screenings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy anamneses_admin on public.anamneses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatment_packages_admin on public.treatment_packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy package_services_admin on public.package_services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatments_admin on public.treatments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatment_sessions_admin on public.treatment_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy evolutions_admin on public.evolutions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_admin on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy expense_categories_admin on public.expense_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy expenses_admin on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- MIGRAÇÃO: 20260925130000_servicos_exibicao.sql
-- ---------------------------------------------------------------------------
-- A duração cadastrada no seed (60 min) é provisória: o sistema precisa de um valor para calcular
-- horários, mas o site não deve exibi-la como se fosse informação real. `duration_confirmed`
-- controla a exibição pública; o cálculo de agenda usa duration_minutes de qualquer forma.
alter table public.services add column duration_confirmed boolean not null default false;

-- ---------------------------------------------------------------------------
-- MIGRAÇÃO: 20260925140000_triagem_publica.sql
-- ---------------------------------------------------------------------------
-- Etapa 3: triagem pública.
--
-- 1) Trava de produção: enquanto NÃO houver termo de consentimento ATIVO, a triagem não coleta
--    dados (o texto oficial ainda não existe). O ambiente local/demo relaxa a trava; produção não.
-- 2) A agenda comanda o estado da triagem: agendar uma avaliação ligada à triagem move o lead para
--    "avaliação agendada"; concluir a avaliação o move para "avaliada".

alter table public.settings
  add column screening_requires_consent_term boolean not null default true;

create index screenings_source_idx on public.screenings (source, created_at desc);

-- submit_screening v2: mesma assinatura; acrescenta a trava do termo.
create or replace function public.submit_screening(
  p_name text,
  p_phone text,
  p_email text default null,
  p_source text default 'site',
  p_source_detail text default null,
  p_interest_area text default null,
  p_goal text default null,
  p_complaint text default null,
  p_desired_outcome text default null,
  p_answers jsonb default '{}'::jsonb,
  p_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_client uuid;
  v_term uuid;
  v_id uuid;
  v_requires boolean;
  v_source text := case when p_source in ('instagram', 'site', 'referral', 'whatsapp', 'other') then p_source else 'other' end;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if p_consent is not true then raise exception 'consent_required' using errcode = 'P0001'; end if;
  if p_interest_area is not null and p_interest_area not in ('facial_olhar', 'corporal_modelagem', 'terapias_bem_estar', 'not_sure') then
    raise exception 'invalid_interest' using errcode = 'P0001';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) >= 16384 then
    raise exception 'invalid_answers' using errcode = 'P0001';
  end if;

  select id into v_term from public.consent_terms where kind = 'screening' and active;
  select screening_requires_consent_term into v_requires from public.settings limit 1;
  if coalesce(v_requires, true) and v_term is null then
    raise exception 'consent_term_missing' using errcode = 'P0001';
  end if;

  -- Freio simples contra abuso: no máximo 3 triagens por telefone em 24 h.
  if (select count(*) from public.screenings s join public.clients c on c.id = s.client_id
      where c.phone = v_phone and s.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  -- O nome de um cliente já cadastrado NÃO é sobrescrito por quem só conhece o telefone.
  insert into public.clients (name, phone, email)
  values (trim(p_name), v_phone, nullif(trim(coalesce(p_email, '')), ''))
  on conflict (phone) do update set email = coalesce(public.clients.email, excluded.email)
  returning id into v_client;

  insert into public.screenings (client_id, source, source_detail, interest_area, goal, complaint, desired_outcome, answers, consent_term_id, consented_at)
  values (v_client, v_source, nullif(trim(coalesce(p_source_detail, '')), ''), p_interest_area, nullif(trim(coalesce(p_goal, '')), ''),
          nullif(trim(coalesce(p_complaint, '')), ''), nullif(trim(coalesce(p_desired_outcome, '')), ''), p_answers, v_term, now())
  returning id into v_id;

  return v_id;
end;
$$;

-- A agenda comanda o estado da triagem.
create or replace function public.sync_screening_from_appointment()
returns trigger language plpgsql as $$
begin
  if new.kind <> 'evaluation' or new.screening_id is null then return new; end if;

  if tg_op = 'INSERT' and new.status <> 'cancelled' then
    update public.screenings set status = 'evaluation_scheduled'
    where id = new.screening_id and status in ('new', 'in_review');
  elsif tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from new.status then
    update public.screenings set status = 'evaluated'
    where id = new.screening_id and status in ('new', 'in_review', 'evaluation_scheduled');
  end if;
  return new;
end;
$$;

create trigger appointments_sync_screening_ins after insert on public.appointments
for each row execute function public.sync_screening_from_appointment();
create trigger appointments_sync_screening_upd after update of status on public.appointments
for each row execute function public.sync_screening_from_appointment();

-- ---------------------------------------------------------------------------
-- MIGRAÇÃO: 20260926100000_anamnese.sql
-- ---------------------------------------------------------------------------
-- Etapa 4: anamnese profissional.
-- A pré-anamnese é a própria triagem (anamneses.screening_id). Aqui ficam as garantias de integridade
-- do registro profissional. Não há campo de diagnóstico: o sistema é de gestão e acompanhamento.

-- Uma cliente só pode ter UM rascunho por vez (evita anamneses duplicadas abertas).
create unique index anamneses_one_draft on public.anamneses (client_id) where status = 'draft';

-- Concluída exige data da avaliação e algum conteúdo profissional.
alter table public.anamneses
  add column completed_at timestamptz,
  add constraint anamneses_completed_has_date check (status <> 'completed' or assessed_at is not null),
  add constraint anamneses_completed_has_content check (
    status <> 'completed'
    or coalesce(nullif(trim(evaluation), ''), nullif(trim(professional_notes), ''), nullif(trim(relevant_history), '')) is not null
  ),
  add constraint anamneses_text_size check (
    coalesce(char_length(evaluation), 0) <= 6000 and coalesce(char_length(relevant_history), 0) <= 6000
    and coalesce(char_length(contraindications), 0) <= 6000 and coalesce(char_length(additional_info), 0) <= 6000
    and coalesce(char_length(professional_notes), 0) <= 6000
  );

-- completed_at acompanha a conclusão (e some ao reabrir).
create or replace function public.anamneses_track_completion()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at = now();
  elsif new.status = 'draft' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;
create trigger anamneses_completion before insert or update on public.anamneses
for each row execute function public.anamneses_track_completion();

-- Concluir a anamnese de uma triagem = avaliação feita (não retrocede estados mais avançados).
create or replace function public.anamneses_sync_screening()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and new.screening_id is not null and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    update public.screenings set status = 'evaluated'
    where id = new.screening_id and status in ('new', 'in_review', 'evaluation_scheduled');
  end if;
  return new;
end;
$$;
create trigger anamneses_sync_screening after insert or update of status on public.anamneses
for each row execute function public.anamneses_sync_screening();

-- ---------------------------------------------------------------------------
-- SEED DE PRODUÇÃO: supabase/seed.sql
-- ---------------------------------------------------------------------------
-- Seed de PRODUÇÃO: sem dados fictícios. Tudo entre colchetes é PLACEHOLDER e deve ser substituído pelo painel
-- (/admin/servicos, /admin/conteudo, /admin/faq, /admin/configuracoes).
-- Horários abaixo são um padrão de partida, não o expediente real da Jennifer.

insert into public.settings (id) values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.availability (weekday, is_open, open_time, close_time, break_start, break_end) values
  (0, false, null, null, null, null),
  (1, true, '09:00', '18:00', '12:00', '13:00'),
  (2, true, '09:00', '18:00', '12:00', '13:00'),
  (3, true, '09:00', '18:00', '12:00', '13:00'),
  (4, true, '09:00', '18:00', '12:00', '13:00'),
  (5, true, '09:00', '18:00', '12:00', '13:00'),
  (6, true, '09:00', '13:00', null, null)
on conflict (weekday) do nothing;

-- Catálogo real informado pela Jennifer. DURAÇÃO (60 min) é PROVISÓRIA: o sistema exige um valor para calcular
-- horários; confirme cada uma em /admin/servicos. Descrição, indicação e valor ficam vazios de propósito.
insert into public.services (slug, name, category, duration_minutes, display_order) values
  ('limpeza-de-pele', 'Limpeza de Pele', 'facial_olhar', 60, 1),
  ('peeling-dermaplaning', 'Peeling Dermaplaning', 'facial_olhar', 60, 2),
  ('brow-lamination', 'Brow Lamination', 'facial_olhar', 60, 3),
  ('lash-lifting', 'Lash Lifting', 'facial_olhar', 60, 4),
  ('design-de-sobrancelhas', 'Design de Sobrancelhas', 'facial_olhar', 60, 5),
  ('lipo-sem-corte', 'Lipo sem Corte', 'corporal_modelagem', 60, 6),
  ('hidrolipoclasia', 'Hidrolipoclasia', 'corporal_modelagem', 60, 7),
  ('massagem-modeladora', 'Massagem Modeladora', 'corporal_modelagem', 60, 8),
  ('drenagem-linfatica', 'Drenagem Linfática', 'corporal_modelagem', 60, 9),
  ('massagem-relaxante', 'Massagem Relaxante', 'terapias_bem_estar', 60, 10),
  ('ventosaterapia', 'Ventosaterapia', 'terapias_bem_estar', 60, 11),
  ('calm-vibes', 'Calm Vibes', 'terapias_bem_estar', 60, 12)
on conflict (slug) do nothing;

-- Categorias de despesa (só rótulos; nenhum valor).
insert into public.expense_categories (name, kind) values
  ('Aluguel', 'fixed'), ('Internet e telefone', 'fixed'), ('Sistemas e assinaturas', 'fixed'),
  ('Energia e água', 'fixed'),
  ('Produtos e cosméticos', 'variable'), ('Materiais descartáveis', 'variable'), ('Insumos', 'variable'),
  ('Outros gastos', 'variable')
on conflict (name) do nothing;

insert into public.site_content (key, value) values
  ('hero.tagline', 'Cuidado com precisão, feito por gente.'),
  ('philosophy.text', 'Antes de qualquer procedimento, uma conversa e uma leitura atenta da pele e do corpo. O plano é definido com você, no seu ritmo.'),
  ('about.role', '[Formação e especialização da Jennifer — informar]'),
  ('about.text', '[Trajetória real da Jennifer — a ser informada]'),
  ('about.approach', '[Abordagem de atendimento — a ser informada]'),
  ('about.experience', '[Experiência profissional — a ser informada]'),
  ('space.text', '[Descrição real do espaço de atendimento]'),
  ('contact.hours_note', '')
on conflict (key) do nothing;

insert into public.faq (question, answer, display_order) values
  ('Como agendo um horário?', 'Pelo site, em quatro passos: escolha o procedimento, a data e o horário, informe seus dados e confirme. A Jennifer confirma o agendamento por WhatsApp.', 1),
  ('Quanto tempo dura cada atendimento?', 'A duração aparece em cada procedimento, antes de você escolher o horário.', 2),
  ('Preciso me preparar antes do atendimento?', '[Orientações de preparação — informar]', 3),
  ('Quais são as formas de pagamento?', '[Formas de pagamento — informar]', 4),
  ('Posso cancelar ou remarcar?', '[Política de cancelamento e remarcação — informar]', 5),
  ('Onde fica o atendimento?', '[Endereço e orientações de chegada — informar]', 6),
  ('Tenho dúvida se um procedimento é indicado para mim.', 'Chame no WhatsApp antes de agendar. A indicação depende de uma avaliação individual.', 7);

-- ---------------------------------------------------------------------------
-- PÓS-INSTALAÇÃO (rode SEPARADO, depois de criar o usuário em Authentication → Users):
--
--   insert into public.admin_profiles (user_id, display_name)
--   values ('COLE-AQUI-O-UUID-DO-USUARIO', 'Jennifer Camila');
--
-- Sem essa linha o painel recusa o acesso, mesmo com login válido.
-- ---------------------------------------------------------------------------
