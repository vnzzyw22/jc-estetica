-- Seed inicial. Tudo entre colchetes é PLACEHOLDER e deve ser substituído pelo painel
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

insert into public.services (slug, name, category, description, indication, duration_minutes, price, display_order) values
  ('procedimento-facial-1', '[Procedimento facial 1]', 'facial', '[Descrição real do procedimento]', '[Indicação real]', 60, null, 1),
  ('procedimento-facial-2', '[Procedimento facial 2]', 'facial', '[Descrição real do procedimento]', '[Indicação real]', 90, null, 2),
  ('procedimento-facial-3', '[Procedimento facial 3]', 'facial', '[Descrição real do procedimento]', '[Indicação real]', 45, null, 3),
  ('procedimento-corporal-1', '[Procedimento corporal 1]', 'corporal', '[Descrição real do procedimento]', '[Indicação real]', 60, null, 4),
  ('procedimento-corporal-2', '[Procedimento corporal 2]', 'corporal', '[Descrição real do procedimento]', '[Indicação real]', 75, null, 5),
  ('protocolo-1', '[Protocolo 1]', 'protocolos', '[Descrição real do protocolo]', '[Indicação real]', 120, null, 6)
on conflict (slug) do nothing;

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
