-- Fix kanban_type check constraint to include 'exit' type
ALTER TABLE public.mentees DROP CONSTRAINT IF EXISTS mentees_kanban_type_check;
ALTER TABLE public.mentees ADD CONSTRAINT mentees_kanban_type_check CHECK (kanban_type IN ('initial', 'mentorship', 'exit'));
