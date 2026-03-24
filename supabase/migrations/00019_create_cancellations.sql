create table public.cancellations (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references public.mentees(id) not null,
  reason text not null,
  cancelled_at date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.cancellations enable row level security;

create policy "Authenticated users can read cancellations"
  on public.cancellations for select to authenticated using (true);
create policy "Authenticated users can insert cancellations"
  on public.cancellations for insert to authenticated with check (true);
create policy "Admins can update cancellations"
  on public.cancellations for update to authenticated
  using (public.get_user_role() = 'admin');
create policy "Admins can delete cancellations"
  on public.cancellations for delete to authenticated
  using (public.get_user_role() = 'admin');
