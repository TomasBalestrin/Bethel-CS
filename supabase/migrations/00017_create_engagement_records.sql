create type public.engagement_type as enum (
  'area_membros', 'mentoria_ao_vivo', 'evento', 'canal_especialista'
);

create table public.engagement_records (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  type public.engagement_type not null,
  value numeric(10,2) not null,
  response_time_minutes integer,
  recorded_at date not null,
  created_by uuid references public.profiles(id),
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
