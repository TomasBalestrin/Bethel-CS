-- System settings for admin-configurable parameters
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  label text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system_settings"
  ON system_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage system_settings"
  ON system_settings FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Default settings
INSERT INTO system_settings (key, value, label, description) VALUES
  ('attendance_gap_minutes', '120', 'Gap de atendimento (minutos)', 'Intervalo mínimo entre mensagens para contar como novo atendimento. Padrão: 120 (2 horas)')
ON CONFLICT (key) DO NOTHING;
