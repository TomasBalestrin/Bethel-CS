-- Allow start_date to be null for mentees imported without a date
ALTER TABLE mentees ALTER COLUMN start_date DROP NOT NULL;
