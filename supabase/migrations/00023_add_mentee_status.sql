-- Status do mentorado: ativo, cancelado, concluido
alter table public.mentees
  add column if not exists status text not null default 'ativo'
  check (status in ('ativo','cancelado','concluido'));
