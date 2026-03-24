-- Permitir que especialista também possa criar e mover mentorados
-- Anteriormente apenas admin podia fazer insert/update em mentees

-- Substituir política de insert: agora qualquer autenticado pode inserir
drop policy if exists "Admins can insert mentees" on public.mentees;
create policy "Authenticated users can insert mentees"
  on public.mentees for insert
  to authenticated
  with check (true);

-- Substituir política de update: agora qualquer autenticado pode atualizar
-- (necessário para mover cards no kanban)
drop policy if exists "Admins can update mentees" on public.mentees;
create policy "Authenticated users can update mentees"
  on public.mentees for update
  to authenticated
  using (true);
