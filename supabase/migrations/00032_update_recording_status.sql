-- Update recording_status constraint to include 'unavailable'
ALTER TABLE call_records DROP CONSTRAINT IF EXISTS call_records_recording_status_check;
ALTER TABLE call_records ADD CONSTRAINT call_records_recording_status_check
  CHECK (recording_status IN ('pending','processing','ready','failed','unavailable'));
