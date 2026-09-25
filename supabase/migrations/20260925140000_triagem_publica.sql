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
