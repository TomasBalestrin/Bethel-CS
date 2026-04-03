-- Attendance notes with AI-generated summaries
CREATE TABLE IF NOT EXISTS attendance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  specialist_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  summary text NOT NULL,
  questions text,
  difficulties text,
  next_steps text,
  generated_by_ai boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE attendance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage attendance_notes"
  ON attendance_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup by mentee
CREATE INDEX idx_attendance_notes_mentee ON attendance_notes(mentee_id, created_at DESC);
