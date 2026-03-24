-- Allow anon users to read mentees by action_plan_token (for public form)
create policy "Anon can read mentee by token"
  on public.mentees for select
  to anon
  using (action_plan_token is not null);

-- Allow anon users to insert/update action_plans (for public form submission)
create policy "Anon can insert action_plans"
  on public.action_plans for insert
  to anon
  with check (true);

create policy "Anon can update action_plans"
  on public.action_plans for update
  to anon
  using (true);
