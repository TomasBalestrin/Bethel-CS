-- Objetivos atingidos por mentorado
create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  title text not null,
  description text,
  achieved_at date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
