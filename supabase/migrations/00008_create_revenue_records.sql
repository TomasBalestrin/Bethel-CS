-- Crossell / upsell
create table public.revenue_records (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  product_name text not null,
  sale_value numeric(10,2) not null,
  entry_value numeric(10,2) not null,
  registered_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
