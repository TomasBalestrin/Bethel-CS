-- Seed: Etapas Iniciais (6 etapas)
insert into public.kanban_stages (type, name, position) values
  ('initial', 'Boas-vindas + envio de contrato', 1),
  ('initial', 'Envio do formulário', 2),
  ('initial', 'Ligação de mapeamento', 3),
  ('initial', 'Call de onboarding', 4),
  ('initial', 'Liberação de acesso', 5),
  ('initial', 'Envio do Plano de Ação', 6);

-- Seed: Etapas Mentoria (7 etapas)
insert into public.kanban_stages (type, name, position) values
  ('mentorship', 'Estruturação dos produtos', 1),
  ('mentorship', 'Vendas no funil atual', 2),
  ('mentorship', 'Funis utilizando base de clientes', 3),
  ('mentorship', 'Funil levantada de mão', 4),
  ('mentorship', 'Otimização dos funis', 5),
  ('mentorship', 'Aumentar a capacidade do modelo de negócio', 6),
  ('mentorship', 'Gestão e expansão', 7);
