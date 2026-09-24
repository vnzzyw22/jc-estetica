-- ============================================================================
-- DADOS DEMONSTRATIVOS — NUNCA RODAR NO BANCO DE PRODUÇÃO.
-- Só para o modo local (npm run demo:load) e para um projeto Supabase de DEMONSTRAÇÃO.
--
-- Tudo aqui é fictício: nomes com sobrenomes como "Exemplo" e "Modelo"; telefones começam com
-- "009" (DDD inexistente, portanto inválidos); valores em reais são inventados só para o
-- dashboard e o financeiro terem o que mostrar. As datas são relativas a hoje.
-- Para remover: supabase/demo/clear-demo.sql.
-- ============================================================================
do $$
declare
  tz constant text := 'America/Sao_Paulo';
  c_ana uuid := '00000000-0000-4000-8000-0000000000a1';
  c_bruna uuid := '00000000-0000-4000-8000-0000000000a2';
  c_carla uuid := '00000000-0000-4000-8000-0000000000a3';
  c_daniela uuid := '00000000-0000-4000-8000-0000000000a4';
  c_elisa uuid := '00000000-0000-4000-8000-0000000000a5';
  c_fernanda uuid := '00000000-0000-4000-8000-0000000000a6';
  c_gabriela uuid := '00000000-0000-4000-8000-0000000000a7';
  c_helena uuid := '00000000-0000-4000-8000-0000000000a8';
  s_limpeza uuid; s_peeling uuid; s_lash uuid; s_lipo uuid; s_drenagem uuid; s_modeladora uuid; s_relax uuid; s_ventosa uuid;
  pk_facial uuid; pk_corporal uuid; pk_relax uuid;
  scr_ana uuid; scr_bruna uuid; scr_carla uuid; scr_elisa uuid;
  t_ana uuid; t_bruna uuid; t_carla uuid; t_daniela uuid;
  sess record;
  n integer;
  cat_fixed_rent uuid; cat_fixed_net uuid; cat_fixed_sys uuid; cat_var_prod uuid; cat_var_mat uuid;
  m integer;

  -- data local + hora → timestamptz
  ts timestamptz;
begin
  if exists (select 1 from public.clients where phone like '009%') then
    raise notice 'Dados demonstrativos já carregados; nada a fazer.';
    return;
  end if;

  select id into s_limpeza from public.services where slug = 'limpeza-de-pele';
  select id into s_peeling from public.services where slug = 'peeling-dermaplaning';
  select id into s_lash from public.services where slug = 'lash-lifting';
  select id into s_lipo from public.services where slug = 'lipo-sem-corte';
  select id into s_drenagem from public.services where slug = 'drenagem-linfatica';
  select id into s_modeladora from public.services where slug = 'massagem-modeladora';
  select id into s_relax from public.services where slug = 'massagem-relaxante';
  select id into s_ventosa from public.services where slug = 'ventosaterapia';

  -- Clientes -----------------------------------------------------------------
  insert into public.clients (id, name, phone, email, notes, created_at) values
    (c_ana,      'Ana Exemplo',        '00900000011', null,                 'Dado demonstrativo.', now() - interval '95 days'),
    (c_bruna,    'Bruna Modelo',       '00900000012', 'bruna@exemplo.invalid', 'Dado demonstrativo.', now() - interval '40 days'),
    (c_carla,    'Carla Demonstração', '00900000013', null,                 'Dado demonstrativo.', now() - interval '6 days'),
    (c_daniela,  'Daniela Teste',      '00900000014', null,                 'Dado demonstrativo.', now() - interval '25 days'),
    (c_elisa,    'Elisa Fictícia',     '00900000015', null,                 'Dado demonstrativo.', now() - interval '3 days'),
    (c_fernanda, 'Fernanda Amostra',   '00900000016', null,                 'Dado demonstrativo.', now() - interval '2 days'),
    (c_gabriela, 'Gabriela Simulada',  '00900000017', null,                 'Dado demonstrativo.', now() - interval '1 day'),
    (c_helena,   'Helena Ilustrativa', '00900000018', null,                 'Dado demonstrativo.', now() - interval '12 hours');

  -- Termo de consentimento: NÃO criamos texto jurídico. O demo usa um marcador claramente provisório.
  insert into public.consent_terms (kind, version, body, active, published_at)
  select 'screening', 'demo', '[Texto oficial de consentimento — a ser fornecido. Este é só um marcador da demonstração.]', true, now()
  where not exists (select 1 from public.consent_terms where kind = 'screening' and active);

  -- Triagens (leads) em vários estágios --------------------------------------
  insert into public.screenings (client_id, status, source, interest_area, goal, complaint, desired_outcome, answers, consented_at, created_at, status_changed_at)
  values (c_ana, 'treatment_active', 'instagram', 'facial_olhar', 'Rejuvenescimento', 'Linhas finas e pele sem viço', 'Pele mais firme e luminosa', '{"usa_protetor": "sim"}', now() - interval '95 days', now() - interval '95 days', now() - interval '90 days')
  returning id into scr_ana;
  insert into public.screenings (client_id, status, source, interest_area, goal, complaint, desired_outcome, answers, consented_at, created_at, status_changed_at)
  values (c_bruna, 'treatment_active', 'referral', 'corporal_modelagem', 'Modelagem corporal', 'Retenção de líquido e medidas na região abdominal', 'Reduzir medidas e desinchar', '{"pratica_atividade": "3x por semana"}', now() - interval '40 days', now() - interval '40 days', now() - interval '30 days')
  returning id into scr_bruna;
  insert into public.screenings (client_id, status, source, interest_area, goal, complaint, desired_outcome, answers, consented_at, created_at, status_changed_at)
  values (c_carla, 'treatment_proposed', 'instagram', 'terapias_bem_estar', 'Relaxamento', 'Estresse e tensão nos ombros', 'Aliviar a tensão e dormir melhor', '{}', now() - interval '6 days', now() - interval '6 days', now() - interval '1 day')
  returning id into scr_carla;
  insert into public.screenings (client_id, status, source, interest_area, goal, complaint, desired_outcome, answers, consented_at, created_at, status_changed_at)
  values (c_elisa, 'evaluation_scheduled', 'instagram', 'facial_olhar', 'Tratar manchas', 'Manchas e textura da pele', 'Melhorar a aparência e a uniformidade', '{}', now() - interval '3 days', now() - interval '3 days', now() - interval '1 day')
  returning id into scr_elisa;
  insert into public.screenings (client_id, status, source, interest_area, goal, complaint, desired_outcome, answers, consented_at, created_at) values
    (c_fernanda, 'in_review', 'whatsapp', 'facial_olhar', 'Sobrancelhas e cílios', 'Quer definir o olhar', 'Sobrancelhas alinhadas e cílios levantados', '{}', now() - interval '2 days', now() - interval '2 days'),
    (c_gabriela, 'new', 'instagram', 'corporal_modelagem', 'Reduzir medidas', 'Gordura localizada', 'Modelar a silhueta', '{}', now() - interval '1 day', now() - interval '1 day'),
    (c_helena, 'new', 'site', 'not_sure', 'Ainda não sei', 'Quer entender o que faz sentido para o caso', 'Uma orientação', '{}', now() - interval '12 hours', now() - interval '12 hours');
  insert into public.screenings (client_id, status, source, interest_area, goal, complaint, consented_at, created_at, status_changed_at)
  values (c_daniela, 'closed', 'instagram', 'corporal_modelagem', 'Drenagem', 'Inchaço nas pernas', now() - interval '25 days', now() - interval '25 days', now() - interval '20 days');

  -- Anamneses (registro profissional; texto neutro de demonstração) ------------
  insert into public.anamneses (client_id, screening_id, status, assessed_at, evaluation, relevant_history, additional_info, professional_notes)
  values
    (c_ana, scr_ana, 'completed', now() - interval '92 days', 'Avaliação demonstrativa da pele.', 'Sem histórico relevante informado (demo).', 'Registro fictício.', 'Anotação profissional fictícia para demonstração.'),
    (c_bruna, scr_bruna, 'completed', now() - interval '35 days', 'Avaliação demonstrativa corporal.', 'Sem histórico relevante informado (demo).', 'Registro fictício.', 'Anotação profissional fictícia para demonstração.');

  -- Pacotes -------------------------------------------------------------------
  insert into public.treatment_packages (name, goal, session_count, interval_days, frequency_note, price, validity_days, notes)
  values ('Protocolo de Rejuvenescimento Facial', 'Firmeza e luminosidade da pele', 8, 15, '2 sessões por mês', 2400.00, 180, 'Valor demonstrativo.') returning id into pk_facial;
  insert into public.treatment_packages (name, goal, session_count, interval_days, frequency_note, price, validity_days, notes)
  values ('Protocolo Corporal', 'Modelagem e redução de medidas', 10, 7, '1 sessão por semana', 1800.00, 120, 'Valor demonstrativo.') returning id into pk_corporal;
  insert into public.treatment_packages (name, goal, session_count, interval_days, frequency_note, price, validity_days, notes)
  values ('Ritual de Relaxamento', 'Alívio da tensão e bem-estar', 4, 14, 'A cada 15 dias', 700.00, 90, 'Valor demonstrativo.') returning id into pk_relax;
  insert into public.package_services (package_id, service_id, position) values
    (pk_facial, s_limpeza, 1), (pk_facial, s_peeling, 2),
    (pk_corporal, s_lipo, 1), (pk_corporal, s_drenagem, 2), (pk_corporal, s_modeladora, 3),
    (pk_relax, s_relax, 1), (pk_relax, s_ventosa, 2);

  -- Tratamento 1: Ana — facial, 8 sessões (6 feitas, a 7ª é hoje, a 8ª a agendar) ---
  t_ana := public.create_treatment_from_package(c_ana, pk_facial, scr_ana);
  perform public.activate_treatment(t_ana);
  update public.treatments set started_at = now() - interval '90 days', proposed_at = now() - interval '92 days' where id = t_ana;
  for n in 1..6 loop
    ts := ((current_date - ((7 - n) * 15))::timestamp + time '14:30') at time zone tz;
    perform public.schedule_session((select id from public.treatment_sessions where treatment_id = t_ana and number = n), ts, 60);
    perform public.complete_session((select id from public.treatment_sessions where treatment_id = t_ana and number = n),
      case n when 1 then 'Primeira sessão: pele sensível, seguimos com cuidado (demo).' when 4 then 'Pele mais uniforme (demo).' else null end);
  end loop;
  ts := (current_date::timestamp + time '14:30') at time zone tz;
  perform public.schedule_session((select id from public.treatment_sessions where treatment_id = t_ana and number = 7), ts, 60);
  update public.appointments set status = 'confirmed' where id = (select appointment_id from public.treatment_sessions where treatment_id = t_ana and number = 7);
  perform public.create_payment_plan(t_ana, 4, current_date - 90, 'pix');
  update public.payments set status = 'paid', paid_at = (due_date::timestamp + time '12:00') at time zone tz
  where treatment_id = t_ana and installment_number <= 3;

  -- Tratamento 2: Bruna — corporal, 10 sessões (2 feitas, a 3ª é hoje) ------------
  t_bruna := public.create_treatment_from_package(c_bruna, pk_corporal, scr_bruna);
  perform public.activate_treatment(t_bruna);
  update public.treatments set started_at = now() - interval '30 days' where id = t_bruna;
  for n in 1..2 loop
    ts := ((current_date - ((3 - n) * 7))::timestamp + time '11:00') at time zone tz;
    perform public.schedule_session((select id from public.treatment_sessions where treatment_id = t_bruna and number = n), ts, 60);
    perform public.complete_session((select id from public.treatment_sessions where treatment_id = t_bruna and number = n), null);
  end loop;
  ts := (current_date::timestamp + time '11:00') at time zone tz;
  perform public.schedule_session((select id from public.treatment_sessions where treatment_id = t_bruna and number = 3), ts, 60);
  perform public.create_payment_plan(t_bruna, 2, current_date - 30, 'credit');
  update public.payments set status = 'paid', paid_at = (due_date::timestamp + time '12:00') at time zone tz
  where treatment_id = t_bruna and installment_number = 1;

  -- Tratamento 3: Carla — proposta enviada (ainda não fechou) ---------------------
  t_carla := public.create_treatment_from_package(c_carla, pk_relax, scr_carla);

  -- Tratamento 4: Daniela — cobrança por sessão, uma sessão realizada há 20 dias ------
  insert into public.treatments (client_id, name, goal, status, total_sessions, billing_mode, session_price, started_at)
  values (c_daniela, 'Drenagem avulsa', 'Alívio do inchaço', 'proposed', 1, 'per_session', 180.00, now() - interval '20 days')
  returning id into t_daniela;
  perform public.activate_treatment(t_daniela);
  update public.treatment_sessions set service_id = s_drenagem where treatment_id = t_daniela;
  ts := ((current_date - 20)::timestamp + time '16:00') at time zone tz;
  perform public.schedule_session((select id from public.treatment_sessions where treatment_id = t_daniela and number = 1), ts, 60);
  perform public.complete_session((select id from public.treatment_sessions where treatment_id = t_daniela and number = 1), null);
  update public.payments set status = 'paid', method = 'pix', paid_at = (due_date::timestamp + time '17:00') at time zone tz where treatment_id = t_daniela;

  -- Agenda de hoje e de amanhã: avaliações e retornos ------------------------------
  ts := (current_date::timestamp + time '16:30') at time zone tz;
  insert into public.appointments (client_id, screening_id, kind, starts_at, ends_at, status, source)
  values (c_elisa, scr_elisa, 'evaluation', ts, ts + interval '60 minutes', 'confirmed', 'admin');
  ts := ((current_date + 1)::timestamp + time '10:00') at time zone tz;
  insert into public.appointments (client_id, service_id, kind, starts_at, ends_at, status, source)
  values (c_fernanda, s_lash, 'service', ts, ts + interval '60 minutes', 'pending', 'site');
  ts := ((current_date + 2)::timestamp + time '15:00') at time zone tz;
  insert into public.appointments (client_id, kind, starts_at, ends_at, status, source)
  values (c_ana, 'return', ts, ts + interval '30 minutes', 'pending', 'admin');

  -- Financeiro: despesas dos últimos 3 meses e um recebimento avulso ---------------
  select id into cat_fixed_rent from public.expense_categories where name = 'Aluguel';
  select id into cat_fixed_net from public.expense_categories where name = 'Internet e telefone';
  select id into cat_fixed_sys from public.expense_categories where name = 'Sistemas e assinaturas';
  select id into cat_var_prod from public.expense_categories where name = 'Produtos e cosméticos';
  select id into cat_var_mat from public.expense_categories where name = 'Materiais descartáveis';
  for m in 0..2 loop
    ts := ((date_trunc('month', current_date) - make_interval(months => m) + interval '4 days')::timestamp + time '10:00') at time zone tz;
    insert into public.expenses (category_id, description, amount, incurred_on, paid_at, is_recurring) values
      (cat_fixed_rent, 'Aluguel da sala (demo)', 850.00, ts::date, case when m = 0 and current_date < ts::date then null else ts end, true),
      (cat_fixed_net, 'Internet (demo)', 110.00, ts::date, ts, true),
      (cat_fixed_sys, 'Sistemas e assinaturas (demo)', 89.90, ts::date, ts, true);
    insert into public.expenses (category_id, description, amount, incurred_on, paid_at) values
      (cat_var_prod, 'Reposição de cosméticos (demo)', 320.00 + m * 45, (ts + interval '8 days')::date, case when m = 0 and current_date < (ts + interval '8 days')::date then null else ts + interval '8 days' end),
      (cat_var_mat, 'Materiais descartáveis (demo)', 96.50, (ts + interval '10 days')::date, case when m = 0 and current_date < (ts + interval '10 days')::date then null else ts + interval '10 days' end);
  end loop;
  insert into public.payments (kind, description, amount, method, status, due_date, paid_at)
  values ('other', 'Venda de produto (demo)', 145.00, 'pix', 'paid', current_date - 5, now() - interval '5 days');
end;
$$;
