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
