-- Add 'channel' column to attendance_sessions for per-channel session isolation
-- Allows multiple concurrent attendance sessions on different chat channels
-- (Principal, Comercial, Marketing, Gestão) for the same mentee.
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'principal';

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_mentee_channel
  ON public.attendance_sessions(mentee_id, channel)
  WHERE ended_at IS NULL;
