-- Call records for Daily.co voice calls
CREATE TABLE IF NOT EXISTS public.call_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid REFERENCES mentees(id) ON DELETE CASCADE,
  specialist_id uuid REFERENCES profiles(id),
  daily_room_name text NOT NULL,
  daily_room_url text NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  recording_status text DEFAULT 'pending'
    CHECK (recording_status IN ('pending','processing','ready','failed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_records_mentee ON call_records(mentee_id);
CREATE INDEX IF NOT EXISTS idx_call_records_specialist ON call_records(specialist_id);
CREATE INDEX IF NOT EXISTS idx_call_records_created ON call_records(created_at DESC);

ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Especialistas veem suas calls"
  ON call_records FOR SELECT
  USING (specialist_id = auth.uid());

CREATE POLICY "Admin vê todas as calls"
  ON call_records FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Call token for mentee public call page
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS call_token uuid DEFAULT gen_random_uuid();
