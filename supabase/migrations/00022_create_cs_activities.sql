-- CS activities: ligações e atendimentos WhatsApp dos especialistas
create table public.cs_activities (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  specialist_id uuid references public.profiles(id),
  type text not null check (type in ('ligacao','whatsapp')),
  duration_minutes numeric(10,2) not null default 0,
  notes text,
  activity_date date not null,
  created_at timestamptz not null default now()
);

alter table public.cs_activities enable row level security;

create policy "Authenticated users can read cs_activities"
  on public.cs_activities for select to authenticated using (true);
create policy "Authenticated users can insert cs_activities"
  on public.cs_activities for insert to authenticated with check (true);
create policy "Admins can update cs_activities"
  on public.cs_activities for update to authenticated
  using (public.get_user_role() = 'admin');
create policy "Admins can delete cs_activities"
  on public.cs_activities for delete to authenticated
  using (public.get_user_role() = 'admin');
