-- Manual attendance sessions (specialist clicks start/stop in chat)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid REFERENCES mentees(id) ON DELETE CASCADE NOT NULL,
  specialist_id uuid REFERENCES profiles(id) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_mentee ON attendance_sessions(mentee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_specialist ON attendance_sessions(specialist_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_started ON attendance_sessions(started_at);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage attendance_sessions" ON attendance_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
