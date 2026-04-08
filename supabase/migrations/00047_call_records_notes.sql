-- Add notes field to call_records for per-call annotations
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS notes text;
