-- Gap 1: Conversion tracking in indications
ALTER TABLE indications ADD COLUMN IF NOT EXISTS converted boolean NOT NULL DEFAULT false;
ALTER TABLE indications ADD COLUMN IF NOT EXISTS converted_name text;
ALTER TABLE indications ADD COLUMN IF NOT EXISTS converted_value numeric(12,2);
ALTER TABLE indications ADD COLUMN IF NOT EXISTS converted_at date;

-- Gap 5: Expand intensivo_records with guest + conversion
ALTER TABLE intensivo_records ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE intensivo_records ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE intensivo_records ADD COLUMN IF NOT EXISTS converted boolean NOT NULL DEFAULT false;
ALTER TABLE intensivo_records ADD COLUMN IF NOT EXISTS converted_name text;
ALTER TABLE intensivo_records ADD COLUMN IF NOT EXISTS converted_value numeric(12,2);

-- Gap 6: Link revenue to specific indication
ALTER TABLE revenue_records ADD COLUMN IF NOT EXISTS indication_id uuid REFERENCES indications(id) ON DELETE SET NULL;

-- Gap 4: Presential events
CREATE TABLE IF NOT EXISTS presential_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  brought_guest boolean NOT NULL DEFAULT false,
  guest_name text,
  guest_phone text,
  converted boolean NOT NULL DEFAULT false,
  converted_name text,
  converted_value numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE presential_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage presential_events" ON presential_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Gap 2: Individual mentoring sessions
CREATE TABLE IF NOT EXISTS individual_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  duration_minutes integer,
  specialist_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE individual_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage individual_sessions" ON individual_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Gap 3: Extra deliveries
CREATE TABLE IF NOT EXISTS extra_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  delivery_type text NOT NULL DEFAULT 'outro',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE extra_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage extra_deliveries" ON extra_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
