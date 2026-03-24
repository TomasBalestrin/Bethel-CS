-- Plano de ação (preenchido pelo mentorado via link público)
create table public.action_plans (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null unique,
  data jsonb not null default '{}',
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
