-- Mentorado principal
create table public.mentees (
  id uuid primary key default gen_random_uuid(),
  -- Dados pessoais
  full_name text not null,
  cpf text,
  birth_date date,
  phone text not null,
  email text,
  instagram text,
  city text,
  state text,
  -- Dados da mentoria
  product_name text not null,
  start_date date not null,
  end_date date,
  priority_level integer not null check (priority_level between 1 and 5) default 1,
  seller_name text,
  funnel_origin text,
  -- Sócio
  has_partner boolean default false,
  partner_name text,
  -- Indicação
  referred_by_mentee_id uuid references public.mentees(id),
  -- Kanban
  current_stage_id uuid references public.kanban_stages(id),
  kanban_type text not null check (kanban_type in ('initial', 'mentorship')) default 'initial',
  -- Controle
  action_plan_token uuid default gen_random_uuid() unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mentees_updated_at
  before update on public.mentees
  for each row execute function public.update_updated_at_column();
