-- Allow system notifications without a mentee reference
ALTER TABLE public.forwarding_notifications ALTER COLUMN mentee_id DROP NOT NULL;
