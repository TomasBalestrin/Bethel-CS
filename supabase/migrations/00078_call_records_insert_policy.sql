-- call_records (migração 00031) tem RLS habilitado mas apenas policies de SELECT
-- para especialistas e ALL para admin. Sem policy de INSERT, qualquer tentativa
-- de especialista gravar uma ligação é silenciosamente rejeitada pelo RLS.
-- Este é o bug que impede ligações de serem registradas (ex: Aline liga e não salva).
--
-- Defesa em profundidade: a rota /api/calls/create também passa a usar o
-- admin client (bypass de RLS), mas manter policies corretas é essencial para
-- o caso de qualquer outro código chamar o banco diretamente no cliente.

CREATE POLICY "Especialistas podem inserir suas calls"
  ON public.call_records FOR INSERT TO authenticated
  WITH CHECK (specialist_id = auth.uid());

CREATE POLICY "Especialistas podem atualizar suas calls"
  ON public.call_records FOR UPDATE TO authenticated
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());
