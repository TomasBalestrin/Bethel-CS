-- Generaliza wpp_insert_errors (só INSERTs em tabelas internas) para
-- system_errors: qualquer operação crítica — INSERT/UPDATE/DELETE de tabela,
-- chamada a API externa (NextTrack, Daily.co, OpenAI), erro de render no
-- client, invariante quebrada detectada por cron, etc.
--
-- Mudanças em relação a 00079:
--   * rename da tabela e do índice
--   * rename target_table → target (agora pode conter 'wpp_messages' OU
--     'nextrack:send-text' OU 'cron:invariants', etc)
--   * nova coluna operation (default 'insert' pros registros antigos)
--   * policy renomeada

ALTER TABLE IF EXISTS public.wpp_insert_errors RENAME TO system_errors;
ALTER TABLE public.system_errors RENAME COLUMN target_table TO target;
ALTER TABLE public.system_errors
  ADD COLUMN IF NOT EXISTS operation text NOT NULL DEFAULT 'insert';

ALTER INDEX IF EXISTS public.idx_wpp_insert_errors_occurred_at
  RENAME TO idx_system_errors_occurred_at;

DROP POLICY IF EXISTS "Admin lê wpp_insert_errors" ON public.system_errors;
CREATE POLICY "Admin lê system_errors"
  ON public.system_errors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
