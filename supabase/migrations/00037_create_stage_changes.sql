-- =============================================
-- Migration: 00037_create_stage_changes
-- Registra movimentações de mentorados no kanban
-- Populado automaticamente por moveMentee()
-- =============================================

CREATE TABLE stage_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentee_id UUID NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES kanban_stages(id),
  to_stage_id UUID NOT NULL REFERENCES kanban_stages(id),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries do dashboard
CREATE INDEX idx_stage_changes_mentee ON stage_changes(mentee_id);
CREATE INDEX idx_stage_changes_date ON stage_changes(changed_at DESC);

-- RLS
ALTER TABLE stage_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_stage_changes" ON stage_changes
  FOR ALL USING (true);
