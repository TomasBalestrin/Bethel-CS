-- Etapas fixas dos dois kanbans (seed na criação)
create table public.kanban_stages (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('initial', 'mentorship')),
  name text not null,
  position integer not null,
  created_at timestamptz not null default now()
);
