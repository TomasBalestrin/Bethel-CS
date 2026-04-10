-- Exit management kanban stages
INSERT INTO public.kanban_stages (type, name, position) VALUES
  ('exit', 'Em Processo de Cancelamento', 0),
  ('exit', 'Pendência Financeira', 1),
  ('exit', 'Pausa', 2),
  ('exit', 'Vai Iniciar Depois', 3),
  ('exit', 'Cancelados', 4)
ON CONFLICT DO NOTHING;
