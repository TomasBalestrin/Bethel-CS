-- =============================================
-- Migration: 00034_add_webhook_mentee_fields
-- Fase 13E: Campos adicionais para webhooks
-- =============================================

ALTER TABLE mentees ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS webhook_notes TEXT;

-- Índice para deduplicação por transaction_id
CREATE INDEX IF NOT EXISTS idx_mentees_transaction_id ON mentees(transaction_id) WHERE transaction_id IS NOT NULL;
