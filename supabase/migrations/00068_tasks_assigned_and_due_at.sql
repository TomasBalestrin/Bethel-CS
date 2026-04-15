-- Tasks: add responsible specialist (assigned_to), precise due datetime (due_at), and reminder tracking
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

-- Index for reminder queries (find tasks approaching due time for a specific user)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_due
  ON public.tasks(assigned_to, due_at)
  WHERE completed_at IS NULL AND reminded_at IS NULL;

-- Backfill due_at from existing due_date (set to 18:00 local)
UPDATE public.tasks
SET due_at = (due_date::text || ' 18:00:00-03:00')::timestamptz
WHERE due_date IS NOT NULL AND due_at IS NULL;
