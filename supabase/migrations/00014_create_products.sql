-- Products table for revenue record product selection
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now() not null
);

alter table public.products enable row level security;

create policy "Authenticated users can read products"
  on public.products for select
  to authenticated
  using (true);

create policy "Admin can manage products"
  on public.products for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
