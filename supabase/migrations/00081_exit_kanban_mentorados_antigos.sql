-- Adiciona "Mentorados Antigos" como primeira coluna do kanban de Saídas.
-- Idempotente: se já existir, não faz nada (não duplica nem re-shifta).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_stages
    WHERE type = 'exit' AND name = 'Mentorados Antigos'
  ) THEN
    -- Empurra todas as etapas atuais 1 posição pra direita
    UPDATE public.kanban_stages
    SET position = position + 1
    WHERE type = 'exit';

    -- Insere a nova primeira coluna em position=0
    INSERT INTO public.kanban_stages (type, name, position)
    VALUES ('exit', 'Mentorados Antigos', 0);
  END IF;
END $$;
