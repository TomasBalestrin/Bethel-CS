-- Enforce a single active attendance session per mentee at any time.
-- Previously any number of channels could have ended_at IS NULL in parallel —
-- the client only recently started blocking other channels when one is active,
-- but two users clicking "Iniciar" simultaneously could still create duplicates.
-- This partial unique index blocks that at the DB level.
--
-- First, close any rows that would violate the new constraint: for each mentee
-- with multiple open sessions, keep the most recent one open and close the rest.
UPDATE public.attendance_sessions AS a
SET ended_at = now()
WHERE a.ended_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.attendance_sessions AS b
    WHERE b.mentee_id = a.mentee_id
      AND b.ended_at IS NULL
      AND b.started_at > a.started_at
  );

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_one_active_per_mentee
  ON public.attendance_sessions (mentee_id)
  WHERE ended_at IS NULL;
