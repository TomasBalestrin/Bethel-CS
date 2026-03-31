-- =============================================
-- Migration: 00035_add_closer_mentee_fields
-- Campos adicionais captados do Bethel Closer
-- =============================================

ALTER TABLE mentees ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS main_pain TEXT;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS main_difficulty TEXT;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS contract_validity TEXT;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS closer_name TEXT;
ALTER TABLE mentees ADD COLUMN IF NOT EXISTS transcription TEXT;
