-- Add missing 'channel' column to wpp_messages.
-- The webhook handler (/api/whatsapp/webhook) has been trying to INSERT with
-- this column since multi-channel chat was introduced, but the column was
-- never created — causing every webhook INSERT to fail silently and incoming
-- WhatsApp messages to never appear in the chat UI.
--
-- Default 'principal' ensures existing rows (and any future INSERT without
-- channel) fall into the main channel.
ALTER TABLE public.wpp_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'principal';

-- Backfill: any legacy rows with null/empty channel get set to 'principal'
UPDATE public.wpp_messages
SET channel = 'principal'
WHERE channel IS NULL OR channel = '';

CREATE INDEX IF NOT EXISTS idx_wpp_messages_mentee_channel
  ON public.wpp_messages(mentee_id, channel);
