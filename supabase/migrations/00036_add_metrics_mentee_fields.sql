-- =============================================
-- Migration: 00036_add_metrics_mentee_fields
-- Campos de performance do Bethel Metrics
-- Atualizados semanalmente via webhook
-- =============================================

ALTER TABLE mentees ADD COLUMN IF NOT EXISTS faturamento_atual DECIMAL(12,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS faturamento_mes_anterior DECIMAL(12,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS faturamento_antes_mentoria DECIMAL(12,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS dias_acessou_sistema INTEGER;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS dias_preencheu INTEGER;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS total_leads INTEGER;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS total_vendas INTEGER;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS total_receita_periodo DECIMAL(12,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS total_entrada_periodo DECIMAL(12,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS taxa_conversao DECIMAL(5,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS ticket_medio DECIMAL(12,2);
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS funis_ativos JSONB;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;
