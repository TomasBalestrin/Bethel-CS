-- Habilitar RLS em todas as tabelas
alter table public.profiles enable row level security;
alter table public.kanban_stages enable row level security;
alter table public.mentees enable row level security;
alter table public.attendances enable row level security;
alter table public.action_plans enable row level security;
alter table public.indications enable row level security;
alter table public.intensivo_records enable row level security;
alter table public.revenue_records enable row level security;
alter table public.objectives enable row level security;
alter table public.testimonials enable row level security;

-- Função helper para verificar role do usuário (security definer evita RLS circular)
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- =============================================
-- PROFILES
-- =============================================
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.get_user_role() = 'admin');

create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- Permitir que o trigger handle_new_user insira profiles
-- (o trigger roda como security definer, então não precisa de policy adicional)

-- =============================================
-- KANBAN_STAGES
-- =============================================
create policy "Authenticated users can read kanban_stages"
  on public.kanban_stages for select
  to authenticated
  using (true);

create policy "Admins can insert kanban_stages"
  on public.kanban_stages for insert
  to authenticated
  with check (public.get_user_role() = 'admin');

create policy "Admins can update kanban_stages"
  on public.kanban_stages for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete kanban_stages"
  on public.kanban_stages for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- MENTEES
-- =============================================
create policy "Authenticated users can read mentees"
  on public.mentees for select
  to authenticated
  using (true);

create policy "Admins can insert mentees"
  on public.mentees for insert
  to authenticated
  with check (public.get_user_role() = 'admin');

create policy "Admins can update mentees"
  on public.mentees for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete mentees"
  on public.mentees for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- ACTION_PLANS
-- =============================================
create policy "Authenticated users can read action_plans"
  on public.action_plans for select
  to authenticated
  using (true);

create policy "Admins can insert action_plans"
  on public.action_plans for insert
  to authenticated
  with check (public.get_user_role() = 'admin');

create policy "Admins can update action_plans"
  on public.action_plans for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete action_plans"
  on public.action_plans for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- ATTENDANCES (especialista pode inserir)
-- =============================================
create policy "Authenticated users can read attendances"
  on public.attendances for select
  to authenticated
  using (true);

create policy "Authenticated users can insert attendances"
  on public.attendances for insert
  to authenticated
  with check (true);

create policy "Admins can update attendances"
  on public.attendances for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete attendances"
  on public.attendances for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- INDICATIONS (especialista pode inserir)
-- =============================================
create policy "Authenticated users can read indications"
  on public.indications for select
  to authenticated
  using (true);

create policy "Authenticated users can insert indications"
  on public.indications for insert
  to authenticated
  with check (true);

create policy "Admins can update indications"
  on public.indications for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete indications"
  on public.indications for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- INTENSIVO_RECORDS (especialista pode inserir)
-- =============================================
create policy "Authenticated users can read intensivo_records"
  on public.intensivo_records for select
  to authenticated
  using (true);

create policy "Authenticated users can insert intensivo_records"
  on public.intensivo_records for insert
  to authenticated
  with check (true);

create policy "Admins can update intensivo_records"
  on public.intensivo_records for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete intensivo_records"
  on public.intensivo_records for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- REVENUE_RECORDS (especialista pode inserir)
-- =============================================
create policy "Authenticated users can read revenue_records"
  on public.revenue_records for select
  to authenticated
  using (true);

create policy "Authenticated users can insert revenue_records"
  on public.revenue_records for insert
  to authenticated
  with check (true);

create policy "Admins can update revenue_records"
  on public.revenue_records for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete revenue_records"
  on public.revenue_records for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- OBJECTIVES (especialista pode inserir)
-- =============================================
create policy "Authenticated users can read objectives"
  on public.objectives for select
  to authenticated
  using (true);

create policy "Authenticated users can insert objectives"
  on public.objectives for insert
  to authenticated
  with check (true);

create policy "Admins can update objectives"
  on public.objectives for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete objectives"
  on public.objectives for delete
  to authenticated
  using (public.get_user_role() = 'admin');

-- =============================================
-- TESTIMONIALS (especialista pode inserir)
-- =============================================
create policy "Authenticated users can read testimonials"
  on public.testimonials for select
  to authenticated
  using (true);

create policy "Authenticated users can insert testimonials"
  on public.testimonials for insert
  to authenticated
  with check (true);

create policy "Admins can update testimonials"
  on public.testimonials for update
  to authenticated
  using (public.get_user_role() = 'admin');

create policy "Admins can delete testimonials"
  on public.testimonials for delete
  to authenticated
  using (public.get_user_role() = 'admin');
