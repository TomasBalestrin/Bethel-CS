-- Swap positions of "Vendas no funil + Funil levantada de mão" (pos 3) and "Funis utilizando base de clientes" (pos 4)
-- so that "Funis utilizando base de clientes" comes BEFORE "Vendas no funil + Funil levantada de mão"
-- Uses a temporary position (99) to avoid unique constraint conflict
UPDATE public.kanban_stages SET position = 99 WHERE type = 'mentorship' AND name = 'Vendas no funil + Funil levantada de mão';
UPDATE public.kanban_stages SET position = 3 WHERE type = 'mentorship' AND name = 'Funis utilizando base de clientes';
UPDATE public.kanban_stages SET position = 4 WHERE type = 'mentorship' AND name = 'Vendas no funil + Funil levantada de mão';
