-- Participação e indicações para o intensivo
create table public.intensivo_records (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  participated boolean default false,
  participation_date date,
  indication_name text,
  indication_phone text,
  created_at timestamptz not null default now()
);
