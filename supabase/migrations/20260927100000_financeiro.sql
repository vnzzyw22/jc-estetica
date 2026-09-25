-- ============================================================================
-- Etapa 6: financeiro (recebimentos, despesas, caixa)
--
-- As tabelas payments / expenses / expense_categories e a view cash_flow já existem
-- (fundação clínica). Esta migração acrescenta:
--   1. cash_flow com descrição, forma de pagamento e nome da categoria (colunas no FIM);
--   2. create_receivable   → cria um recebimento (à vista ou parcelado), avulso ou ligado
--                            a cliente / tratamento / atendimento;
--   3. change_payment_status → transições válidas de um recebimento (receber, desfazer, cancelar);
--   4. generate_recurring_expenses → repete no mês as despesas marcadas como recorrentes.
-- Nenhuma tabela nova; a RLS existente (somente is_admin()) continua valendo. As funções
-- rodam como o usuário que chama (security invoker): sem ser admin, a RLS barra tudo.
-- ============================================================================

-- 1. Caixa: mesmas colunas de antes, na mesma ordem, e três novas no fim.
create or replace view public.cash_flow with (security_invoker = true) as
select
  'in'::text as direction,
  case when p.status = 'paid' then (p.paid_at at time zone 'America/Sao_Paulo')::date else p.due_date end as occurred_on,
  p.amount,
  case when p.status = 'paid' then 'realized' else 'expected' end as state,
  'payment'::text as source,
  p.id as source_id,
  p.client_id,
  p.treatment_id,
  p.kind::text as category,
  p.description,
  p.method,
  null::text as category_name
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
  c.kind::text,
  e.description,
  null,
  c.name
from public.expenses e
join public.expense_categories c on c.id = e.category_id;

-- 2. Recebimento manual. Devolve quantas parcelas criou.
--    Tipo: com atendimento → 'service'; com tratamento → 'treatment'; senão 'other'.
--    A última parcela absorve os centavos (a soma fecha exatamente o total).
--    p_paid_at só vale para pagamento único (registrar algo que já foi recebido).
create or replace function public.create_receivable(
  p_client_id uuid,
  p_description text,
  p_total numeric,
  p_installments integer default 1,
  p_first_due date default current_date,
  p_method text default null,
  p_treatment_id uuid default null,
  p_appointment_id uuid default null,
  p_paid_at timestamptz default null
)
returns integer language plpgsql as $$
declare
  v_client uuid := p_client_id;
  v_desc text := nullif(trim(coalesce(p_description, '')), '');
  v_total numeric(10, 2);
  v_t public.treatments;
  v_a public.appointments;
  v_kind text;
  v_base numeric(10, 2);
  v_amount numeric(10, 2);
  i integer;
begin
  if p_total is null or round(p_total, 2) <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
  v_total := round(p_total, 2);
  if p_installments is null or p_installments < 1 or p_installments > 36 then raise exception 'invalid_installments' using errcode = 'P0001'; end if;
  if p_paid_at is not null and p_installments <> 1 then raise exception 'paid_needs_single' using errcode = 'P0001'; end if;
  if p_paid_at is not null and p_paid_at > now() + interval '1 day' then raise exception 'paid_in_future' using errcode = 'P0001'; end if;

  if p_treatment_id is not null then
    select * into v_t from public.treatments where id = p_treatment_id;
    if not found then raise exception 'treatment_not_found' using errcode = 'P0001'; end if;
    if v_client is null then v_client := v_t.client_id;
    elsif v_client <> v_t.client_id then raise exception 'client_mismatch' using errcode = 'P0001'; end if;
    v_desc := coalesce(v_desc, v_t.name);
  end if;

  if p_appointment_id is not null then
    select * into v_a from public.appointments where id = p_appointment_id;
    if not found then raise exception 'appointment_not_found' using errcode = 'P0001'; end if;
    if v_client is null then v_client := v_a.client_id;
    elsif v_client <> v_a.client_id then raise exception 'client_mismatch' using errcode = 'P0001'; end if;
  end if;

  if v_client is not null and not exists (select 1 from public.clients where id = v_client) then
    raise exception 'client_not_found' using errcode = 'P0001';
  end if;
  if v_desc is null then raise exception 'description_required' using errcode = 'P0001'; end if;

  v_kind := case when p_appointment_id is not null then 'service' when p_treatment_id is not null then 'treatment' else 'other' end;

  v_base := trunc(v_total / p_installments, 2);
  for i in 1..p_installments loop
    v_amount := case when i = p_installments then v_total - v_base * (p_installments - 1) else v_base end;
    insert into public.payments (kind, client_id, treatment_id, appointment_id, description, amount, method, status, paid_at,
                                 installment_number, installment_total, due_date)
    values (v_kind, v_client, p_treatment_id, p_appointment_id, v_desc, v_amount, p_method,
            case when p_paid_at is not null then 'paid' else 'pending' end, p_paid_at,
            i, p_installments, (p_first_due + make_interval(months => i - 1))::date);
  end loop;
  return p_installments;
end;
$$;

-- 3. Transições de um recebimento:
--      pendente → pago | cancelado      pago → pendente (desfazer)      cancelado → pendente (restaurar)
--    Receber exige a forma de pagamento (relatórios por forma dependem dela).
create or replace function public.change_payment_status(
  p_id uuid,
  p_to text,
  p_paid_at timestamptz default null,
  p_method text default null
)
returns void language plpgsql as $$
declare
  v public.payments;
begin
  select * into v from public.payments where id = p_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0001'; end if;

  if p_to = 'paid' then
    if v.status <> 'pending' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
    if coalesce(p_method, v.method) is null then raise exception 'method_required' using errcode = 'P0001'; end if;
    if p_paid_at is not null and p_paid_at > now() + interval '1 day' then raise exception 'paid_in_future' using errcode = 'P0001'; end if;
    update public.payments set status = 'paid', paid_at = coalesce(p_paid_at, now()), method = coalesce(p_method, method) where id = p_id;
  elsif p_to = 'cancelled' then
    if v.status <> 'pending' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
    update public.payments set status = 'cancelled' where id = p_id;
  elsif p_to = 'pending' then
    if v.status not in ('paid', 'cancelled') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
    update public.payments set status = 'pending', paid_at = null where id = p_id;
  else
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
end;
$$;

-- 4. Despesas recorrentes: para cada (categoria, descrição) marcada como recorrente, copia a
--    ocorrência mais recente anterior ao mês para o mês pedido (a pagar, mesmo dia, limitado ao
--    fim do mês). Idempotente: não duplica o que já existe no mês. Devolve quantas criou.
create or replace function public.generate_recurring_expenses(p_month date)
returns integer language plpgsql as $$
declare
  v_first date := date_trunc('month', p_month)::date;
  v_last date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  r record;
  v_count integer := 0;
begin
  for r in
    select distinct on (e.category_id, e.description) e.category_id, e.description, e.amount, e.incurred_on, e.notes
    from public.expenses e
    where e.is_recurring and e.incurred_on < v_first
    order by e.category_id, e.description, e.incurred_on desc
  loop
    if not exists (
      select 1 from public.expenses x
      where x.category_id = r.category_id and x.description = r.description and x.incurred_on between v_first and v_last
    ) then
      insert into public.expenses (category_id, description, amount, incurred_on, is_recurring, notes)
      values (r.category_id, r.description, r.amount, least(v_first + (extract(day from r.incurred_on)::int - 1), v_last), true, r.notes);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.create_receivable(uuid, text, numeric, integer, date, text, uuid, uuid, timestamptz) from public, anon;
revoke execute on function public.change_payment_status(uuid, text, timestamptz, text) from public, anon;
revoke execute on function public.generate_recurring_expenses(date) from public, anon;
grant execute on function public.create_receivable(uuid, text, numeric, integer, date, text, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.change_payment_status(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.generate_recurring_expenses(date) to authenticated;
