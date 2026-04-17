-- Marca entregas como canceladas sem deletar o registro. Mantém participações
-- e histórico, mas permite esconder / estilizar como cancelada no UI.
ALTER TABLE public.delivery_events
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_delivery_events_cancelled_at
  ON public.delivery_events(cancelled_at);
