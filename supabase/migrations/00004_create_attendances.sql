-- Registro de atendimentos do CS
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  specialist_id uuid references public.profiles(id) not null,
  notes text,
  attended_at timestamptz default now(),
  created_at timestamptz not null default now()
);
