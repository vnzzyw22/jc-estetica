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
