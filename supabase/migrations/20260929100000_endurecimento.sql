-- ============================================================================
-- Polimento: duas defesas que precisam estar no banco.
--
--   1. create_booking v3   → no máximo 3 reservas FUTURAS feitas pelo site por telefone (o agendamento
--                            público não tinha freio: alguém poderia ocupar a agenda inteira), e corta
--                            nome, e-mail e observações no tamanho máximo. Mesma assinatura, então o
--                            app não muda de chamada. As regras de horário continuam idênticas às da v2.
--   2. activate_consent_term → troca o termo de consentimento em vigor de forma ATÔMICA. Antes eram dois
--                            passos no app (desativar o antigo, ativar o novo): se o segundo falhasse, a
--                            triagem ficava sem termo e parava de receber envios.
-- Nenhuma tabela nova.
-- ============================================================================

-- 1. create_booking v3 (corpo da v2 + limite por telefone + tamanhos máximos).
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

  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
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

  -- Freio contra ocupar a agenda: no máximo 3 reservas futuras, feitas pelo site, por telefone.
  -- Agendamentos criados pelo painel e os cancelados não contam.
  if (
    select count(*) from public.appointments a join public.clients c on c.id = a.client_id
    where c.phone = v_phone and a.source = 'site' and a.status <> 'cancelled' and a.starts_at > now()
  ) >= 3 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  insert into public.clients (name, phone, email)
  values (trim(p_name), v_phone, nullif(left(trim(coalesce(p_email, '')), 200), ''))
  on conflict (phone) do update set email = coalesce(public.clients.email, excluded.email)
  returning id into v_client;

  insert into public.appointments (client_id, service_id, starts_at, ends_at, status, source, notes, kind)
  values (v_client, p_service_id, p_starts_at, v_ends,
          case when v_settings.auto_confirm then 'confirmed' else 'pending' end,
          'site', nullif(left(trim(coalesce(p_notes, '')), 1000), ''), p_kind)
  returning id into v_appt;

  return v_appt;
end;
$$;

-- 2. Termo de consentimento em vigor, troca atômica. Só um por tipo pode estar ativo (índice único);
--    a função desativa o atual e ativa o escolhido na mesma transação.
create or replace function public.activate_consent_term(p_term_id uuid)
returns void language plpgsql as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.consent_terms where id = p_term_id for update;
  if not found then raise exception 'term_not_found' using errcode = 'P0001'; end if;

  update public.consent_terms set active = false where kind = v_kind and active and id <> p_term_id;
  update public.consent_terms set active = true, published_at = now() where id = p_term_id;
end;
$$;

revoke execute on function public.activate_consent_term(uuid) from public, anon;
grant execute on function public.activate_consent_term(uuid) to authenticated;
