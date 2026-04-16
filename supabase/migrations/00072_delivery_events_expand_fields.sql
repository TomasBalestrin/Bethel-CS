-- Expand delivery_events with rich fields for the new per-delivery panel flow:
--   title         → short name of the delivery (shown on list + panel header)
--   description   → long text (already used in UI code, add column if missing)
--   reference_month → "YYYY-MM" (already used in UI code)
--   presenter_id  → who delivered it (references profiles)
ALTER TABLE public.delivery_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS reference_month text,
  ADD COLUMN IF NOT EXISTS presenter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_events_presenter
  ON public.delivery_events(presenter_id);
