-- Restructure indications table: replace individual name/phone with summary fields
-- Add new columns
ALTER TABLE indications ADD COLUMN IF NOT EXISTS indication_date date DEFAULT CURRENT_DATE;
ALTER TABLE indications ADD COLUMN IF NOT EXISTS quantity_indicated integer DEFAULT 0;
ALTER TABLE indications ADD COLUMN IF NOT EXISTS quantity_confirmed integer DEFAULT 0;
ALTER TABLE indications ADD COLUMN IF NOT EXISTS revenue_generated numeric DEFAULT 0;

-- Make indicated_name and indicated_phone nullable (no longer required)
ALTER TABLE indications ALTER COLUMN indicated_name DROP NOT NULL;
ALTER TABLE indications ALTER COLUMN indicated_phone DROP NOT NULL;
ALTER TABLE indications ALTER COLUMN indicated_name SET DEFAULT '';
ALTER TABLE indications ALTER COLUMN indicated_phone SET DEFAULT '';
