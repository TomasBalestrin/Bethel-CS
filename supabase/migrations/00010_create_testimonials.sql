-- Depoimentos
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  testimonial_date date not null,
  description text not null,
  attachment_url text,
  attachment_type text check (attachment_type in ('photo', 'video')),
  -- Filtros
  niche text,
  revenue_range text,
  employee_count text,
  categories text[] default '{}',
  -- categories válidas:
  -- 'aumento_faturamento', 'vida_pessoal', 'vida_espiritual',
  -- 'contratacao', 'expansao_negocio', 'atendimento',
  -- 'intensivo', 'encontro_elite_premium'
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
