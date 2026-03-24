-- Indicações CS feitas pelo mentorado
create table public.indications (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  indicated_name text not null,
  indicated_phone text not null,
  notes text,
  created_at timestamptz not null default now()
);
