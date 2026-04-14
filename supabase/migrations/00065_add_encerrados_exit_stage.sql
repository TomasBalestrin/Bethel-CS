-- Add "Encerrados" stage to exit kanban (after Cancelados)
INSERT INTO public.kanban_stages (type, name, position)
VALUES ('exit', 'Encerrados', 5)
ON CONFLICT DO NOTHING;
