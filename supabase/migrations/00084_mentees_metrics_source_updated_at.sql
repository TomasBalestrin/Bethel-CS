-- Adiciona coluna para rastrear "quando o dado no Bethel Metrics foi atualizado
-- pela última vez" (distinto de metrics_updated_at, que marca só quando a nossa
-- rota /api/metrics/[menteeId] rodou).
--
-- O semáforo visual (BM badge) usa este campo pra decidir verde/cinza/vermelho
-- — reflete a saúde do dado no BM, não a saúde do nosso pipeline de sync.
ALTER TABLE public.mentees
  ADD COLUMN IF NOT EXISTS metrics_source_updated_at timestamptz;

-- Índice pra o filtro "Apenas BM desatualizado" no Kanban não fazer full scan.
CREATE INDEX IF NOT EXISTS idx_mentees_metrics_source_updated_at
  ON public.mentees(metrics_source_updated_at);
