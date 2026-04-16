-- Replace the profile-linked presenter with a free-text field, since the
-- person who delivered a hotseat/SOS/etc. is often not a user of the system
-- (external speaker, partner, guest, etc.). Keeps presenter_id around as
-- legacy/nullable — nothing reads it anymore.
ALTER TABLE public.delivery_events
  ADD COLUMN IF NOT EXISTS presenter_name text;
