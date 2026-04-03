-- Add personal tags and notes fields to mentees
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS personal_tags text[] DEFAULT '{}';
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS notes text;
