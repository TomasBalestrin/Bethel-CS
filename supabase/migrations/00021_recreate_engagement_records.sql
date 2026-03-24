-- Drop old engagement_records and enum, recreate with spec-aligned types
drop table if exists public.engagement_records;
drop type if exists public.engagement_type;

create table public.engagement_records (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  specialist_id uuid references public.profiles(id),
  type text not null check (type in ('aula','live','evento','whatsapp_contato')),
  value numeric(10,2) not null,
  notes text,
  recorded_at date not null,
  created_at timestamptz not null default now()
);

alter table public.engagement_records enable row level security;

create policy "Authenticated users can read engagement_records"
  on public.engagement_records for select to authenticated using (true);
create policy "Authenticated users can insert engagement_records"
  on public.engagement_records for insert to authenticated with check (true);
create policy "Admins can update engagement_records"
  on public.engagement_records for update to authenticated
  using (public.get_user_role() = 'admin');
create policy "Admins can delete engagement_records"
  on public.engagement_records for delete to authenticated
  using (public.get_user_role() = 'admin');
