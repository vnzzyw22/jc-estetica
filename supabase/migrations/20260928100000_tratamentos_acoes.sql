-- ============================================================================
-- Etapa 5: ações de tratamento que precisam ser atômicas.
--
-- As tabelas e as regras principais (create_treatment_from_package, activate_treatment,
-- schedule_session, complete_session) já existem. Aqui entram:
--   1. cancel_treatment      → cancela o tratamento, as sessões em aberto e os horários delas na agenda
--   2. pause_treatment       → pausa um tratamento ativo (retomar = activate_treatment)
--   3. save_package_services → troca os serviços de um pacote, na ordem recebida (a ordem define o
--                              rodízio dos serviços nas sessões geradas ao ativar)
-- Nenhuma tabela nova; a RLS existente (somente is_admin()) continua valendo. As funções rodam como
-- quem chama (security invoker): sem ser admin, a RLS esconde tudo e elas respondem "não encontrado".
-- ============================================================================

-- 1. Cancelar tratamento. Devolve quantas sessões foram canceladas.
--    Sessões já realizadas ficam como estão (são histórico). Cobranças NÃO são mexidas: o que fazer
--    com o dinheiro (cancelar, manter, devolver) é decisão da Jennifer, no Financeiro.
create or replace function public.cancel_treatment(p_treatment_id uuid)
returns integer language plpgsql as $$
declare
  v_t public.treatments;
  v_appointments uuid[];
  v_count integer;
begin
  select * into v_t from public.treatments where id = p_treatment_id for update;
  if not found then raise exception 'treatment_not_found' using errcode = 'P0001'; end if;
  if v_t.status in ('completed', 'cancelled') then raise exception 'invalid_status' using errcode = 'P0001'; end if;

  select coalesce(array_agg(appointment_id) filter (where appointment_id is not null), '{}')
  into v_appointments
  from public.treatment_sessions
  where treatment_id = v_t.id and status not in ('completed', 'cancelled');

  -- As sessões primeiro: o gatilho da agenda só devolve para "a agendar" as que ainda estão abertas.
  update public.treatment_sessions set status = 'cancelled'
  where treatment_id = v_t.id and status not in ('completed', 'cancelled');
  get diagnostics v_count = row_count;

  -- Libera os horários na agenda (o que já foi concluído fica).
  update public.appointments set status = 'cancelled'
  where id = any (v_appointments) and status <> 'completed';

  update public.treatments set status = 'cancelled' where id = v_t.id;
  return v_count;
end;
$$;

-- 2. Pausar. Só tratamento ativo. As sessões já agendadas continuam na agenda.
create or replace function public.pause_treatment(p_treatment_id uuid)
returns void language plpgsql as $$
begin
  update public.treatments set status = 'paused' where id = p_treatment_id and status = 'active';
  if not found then
    if exists (select 1 from public.treatments where id = p_treatment_id) then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    raise exception 'treatment_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- 3. Serviços de um pacote: substitui a lista inteira, na ordem do array (posição 1, 2, 3…).
--    Tratamentos já ativados não mudam: as sessões deles foram geradas com os serviços de então.
create or replace function public.save_package_services(p_package_id uuid, p_service_ids uuid[])
returns integer language plpgsql as $$
declare
  v_count integer := coalesce(cardinality(p_service_ids), 0);
  i integer;
begin
  if not exists (select 1 from public.treatment_packages where id = p_package_id) then
    raise exception 'package_not_found' using errcode = 'P0001';
  end if;
  if v_count <> (select count(distinct s) from unnest(coalesce(p_service_ids, '{}')) s) then
    raise exception 'duplicate_service' using errcode = 'P0001';
  end if;

  delete from public.package_services where package_id = p_package_id;
  for i in 1..v_count loop
    insert into public.package_services (package_id, service_id, position) values (p_package_id, p_service_ids[i], i);
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.cancel_treatment(uuid) from public, anon;
revoke execute on function public.pause_treatment(uuid) from public, anon;
revoke execute on function public.save_package_services(uuid, uuid[]) from public, anon;
grant execute on function public.cancel_treatment(uuid) to authenticated;
grant execute on function public.pause_treatment(uuid) to authenticated;
grant execute on function public.save_package_services(uuid, uuid[]) to authenticated;
