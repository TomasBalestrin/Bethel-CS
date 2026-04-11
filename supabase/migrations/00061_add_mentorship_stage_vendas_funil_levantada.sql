-- Add new mentorship stage between "Vendas no funil atual" (pos 2) and "Funis utilizando base de clientes" (pos 3)
-- First shift existing stages from position 3+ up by 1
UPDATE public.kanban_stages
SET position = position + 1
WHERE type = 'mentorship' AND position >= 3;

-- Insert the new stage at position 3
INSERT INTO public.kanban_stages (type, name, position)
VALUES ('mentorship', 'Vendas no funil + Funil levantada de mão', 3);
