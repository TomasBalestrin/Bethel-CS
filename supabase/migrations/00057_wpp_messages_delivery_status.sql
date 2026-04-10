-- Add delivery status tracking for outgoing messages
ALTER TABLE public.wpp_messages ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read'));
