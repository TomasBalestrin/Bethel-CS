-- 00082: Move "Mentorados Antigos" do kanban exit (criado em 00081) para
-- mentorship como primeira coluna, e migra todos os mentorados que estão
-- em "Liberação de acesso" (initial) para essa nova coluna em mentorship.
--
-- Idempotente: reverte 00081 com segurança e detecta se já rodou.
DO $$
DECLARE
  old_exit_stage_id uuid;
  default_exit_stage_id uuid;
  new_mentorship_stage_id uuid;
  initial_liberacao_id uuid;
BEGIN
  -- ─── 1. Reverte 00081: remove "Mentorados Antigos" do exit kanban ───
  SELECT id INTO old_exit_stage_id
  FROM public.kanban_stages
  WHERE type = 'exit' AND name = 'Mentorados Antigos';

  IF old_exit_stage_id IS NOT NULL THEN
    -- Caso algum mentorado já tenha sido movido para essa coluna,
    -- realoca pra "Em Processo de Cancelamento" antes de deletar.
    SELECT id INTO default_exit_stage_id
    FROM public.kanban_stages
    WHERE type = 'exit' AND name = 'Em Processo de Cancelamento';

    IF default_exit_stage_id IS NOT NULL THEN
      UPDATE public.mentees
      SET current_stage_id = default_exit_stage_id,
          updated_at = now()
      WHERE current_stage_id = old_exit_stage_id;
    END IF;

    DELETE FROM public.kanban_stages WHERE id = old_exit_stage_id;

    -- Reverte o shift +1 que a 00081 fez
    UPDATE public.kanban_stages
    SET position = position - 1
    WHERE type = 'exit';
  END IF;

  -- ─── 2. Adiciona "Mentorados Antigos" como primeira coluna de mentorship ───
  -- As stages atuais começam em position 1+, então 0 ordena naturalmente antes.
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_stages
    WHERE type = 'mentorship' AND name = 'Mentorados Antigos'
  ) THEN
    INSERT INTO public.kanban_stages (type, name, position)
    VALUES ('mentorship', 'Mentorados Antigos', 0);
  END IF;

  SELECT id INTO new_mentorship_stage_id
  FROM public.kanban_stages
  WHERE type = 'mentorship' AND name = 'Mentorados Antigos';

  -- ─── 3. Move mentorados de "Liberação de acesso" (initial) ─────────
  -- Mantém o snapshot atual: futuros mentorados que entrarem em
  -- "Liberação de acesso" continuarão lá normalmente; só migra os já existentes.
  SELECT id INTO initial_liberacao_id
  FROM public.kanban_stages
  WHERE type = 'initial' AND name = 'Liberação de acesso';

  IF new_mentorship_stage_id IS NOT NULL AND initial_liberacao_id IS NOT NULL THEN
    UPDATE public.mentees
    SET current_stage_id = new_mentorship_stage_id,
        kanban_type = 'mentorship',
        updated_at = now()
    WHERE current_stage_id = initial_liberacao_id;
  END IF;
END $$;
