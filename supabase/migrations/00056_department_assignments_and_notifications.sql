-- Department assignments: link users to departments (comercial, marketing, gestao)
CREATE TABLE IF NOT EXISTS public.department_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department text NOT NULL CHECK (department IN ('comercial', 'marketing', 'gestao')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, department)
);

ALTER TABLE public.department_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read department_assignments"
  ON public.department_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage department_assignments"
  ON public.department_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Forwarding notifications: track encaminhamentos pending for each user
CREATE TABLE IF NOT EXISTS public.forwarding_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentee_id uuid NOT NULL REFERENCES public.mentees(id) ON DELETE CASCADE,
  department text NOT NULL,
  description text NOT NULL,
  mentee_name text NOT NULL,
  mentee_phone text NOT NULL,
  sent_by uuid REFERENCES public.profiles(id),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forwarding_notifications_recipient ON public.forwarding_notifications(recipient_id, is_read);

ALTER TABLE public.forwarding_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own forwarding_notifications"
  ON public.forwarding_notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own forwarding_notifications"
  ON public.forwarding_notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Authenticated can insert forwarding_notifications"
  ON public.forwarding_notifications FOR INSERT TO authenticated
  WITH CHECK (true);
