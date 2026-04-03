-- Add call_type to call_records to differentiate voice/video calls
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS call_type text NOT NULL DEFAULT 'voice';
