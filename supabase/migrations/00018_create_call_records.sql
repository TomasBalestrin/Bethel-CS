create type public.call_type as enum ('ligacao', 'whatsapp');

create table public.call_records (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  duration_minutes integer not null,
  call_type public.call_type not null,
  recorded_at date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.call_records enable row level security;

create policy "Authenticated users can read call_records"
  on public.call_records for select to authenticated using (true);
create policy "Authenticated users can insert call_records"
  on public.call_records for insert to authenticated with check (true);
create policy "Admins can update call_records"
  on public.call_records for update to authenticated
  using (public.get_user_role() = 'admin');
create policy "Admins can delete call_records"
  on public.call_records for delete to authenticated
  using (public.get_user_role() = 'admin');
