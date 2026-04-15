-- Add missing transcription columns to call_records.
-- These columns are referenced in check-recording, retry-recording, transcribe,
-- and recording-ready routes but were never created in a migration.
-- Without them, every UPDATE that includes transcription_status fails,
-- which causes recording_url and recording_status to never be saved either.
-- This is why all recordings were stuck in 'processing' indefinitely.
ALTER TABLE public.call_records
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS transcription_status text
    CHECK (transcription_status IN ('pending', 'processing', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS idx_call_records_transcription_status
  ON public.call_records(transcription_status)
  WHERE transcription_status IS NOT NULL;
