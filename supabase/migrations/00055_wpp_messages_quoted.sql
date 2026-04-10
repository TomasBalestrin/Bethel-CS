-- Add quoted message support for reply/quote in chat
ALTER TABLE public.wpp_messages ADD COLUMN IF NOT EXISTS quoted_message_id text;
