-- =============================================
-- Migration: 00033_create_webhook_tables
-- Fase 13A: Sistema de Webhooks Configurável
-- =============================================

-- =============================================
-- Tabela: webhook_endpoints
-- Cada integração configurada tem um endpoint
-- =============================================
CREATE TABLE webhook_endpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificação
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  platform TEXT NOT NULL DEFAULT 'custom',
  direction TEXT NOT NULL DEFAULT 'inbound',

  -- Segurança
  secret_key TEXT,
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_header TEXT DEFAULT 'x-webhook-secret',

  -- Configuração de ação (inbound)
  default_action TEXT NOT NULL DEFAULT 'log_only',
  field_mapping JSONB NOT NULL DEFAULT '{}',
  event_field TEXT,
  event_actions JSONB NOT NULL DEFAULT '{}',

  -- Configuração de saída (outbound) — inativo nesta fase
  target_url TEXT,
  target_headers JSONB DEFAULT '{}',
  trigger_events TEXT[] DEFAULT '{}',
  payload_template JSONB,

  -- Kanban config
  default_kanban_stage TEXT,
  default_specialist_id UUID REFERENCES auth.users(id),

  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índice para lookup por slug
CREATE INDEX idx_webhook_endpoints_slug ON webhook_endpoints(slug);

-- =============================================
-- Tabela: webhook_logs
-- Log de tudo que entra e sai
-- =============================================
CREATE TABLE webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,

  -- Request
  direction TEXT NOT NULL DEFAULT 'inbound',
  method TEXT DEFAULT 'POST',
  headers JSONB,
  payload JSONB NOT NULL,
  query_params JSONB,
  source_ip TEXT,

  -- Processamento
  event_type TEXT,
  action_executed TEXT,
  action_result JSONB,

  -- Status
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  processing_time_ms INTEGER,

  -- Resposta (outbound)
  response_status INTEGER,
  response_body TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas de log
CREATE INDEX idx_webhook_logs_endpoint ON webhook_logs(endpoint_id);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- =============================================
-- RLS — somente admins e service_role
-- =============================================
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Admins podem tudo (usa função existente get_user_role)
CREATE POLICY "admin_webhook_endpoints" ON webhook_endpoints
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "admin_webhook_logs" ON webhook_logs
  FOR ALL USING (public.get_user_role() = 'admin');
