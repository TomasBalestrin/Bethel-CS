-- Rastreia origem da inserção em wpp_messages para permitir dedup específico:
--   'api'      → inserido por /api/whatsapp/send (mensagem enviada pelo sistema)
--   'webhook'  → inserido pelo webhook do provider (eco de envio OU msg recebida)
--   'imported' → inserido por import manual / script de backfill
-- Default 'webhook' preserva semântica das linhas já existentes (todas vieram
-- do webhook ou do /send atual, que também é tratado como webhook no dedup).
ALTER TABLE public.wpp_messages
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'webhook';

-- Usado pelo webhook para reconciliar apenas linhas recentes inseridas por /send.
CREATE INDEX IF NOT EXISTS idx_wpp_messages_source_sent_at
  ON public.wpp_messages(source, sent_at DESC);
