-- Add WhatsApp phone to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wpp_phone text;
