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
