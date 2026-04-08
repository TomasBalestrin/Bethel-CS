-- Delivery events: tracks when each delivery type occurred
CREATE TABLE IF NOT EXISTS delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_type text NOT NULL,  -- hotseat, comercial, gestao, mkt, extras, mentoria_individual
  delivery_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Delivery participations: tracks which mentee participated in which delivery
CREATE TABLE IF NOT EXISTS delivery_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_event_id uuid REFERENCES delivery_events(id) ON DELETE CASCADE,
  mentee_id uuid REFERENCES mentees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delivery_event_id, mentee_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_delivery_events_type_date ON delivery_events(delivery_type, delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_participations_mentee ON delivery_participations(mentee_id);

-- RLS policies
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage delivery_events"
  ON delivery_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can manage delivery_participations"
  ON delivery_participations FOR ALL TO authenticated USING (true) WITH CHECK (true);
