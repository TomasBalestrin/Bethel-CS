-- Track WhatsApp messages whose phone didn't match any mentee, so an admin
-- can later reconcile typos in the cadastro (most common cause).
CREATE TABLE IF NOT EXISTS public.wpp_orphan_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  sender_name text,
  last_content text,
  attempts int NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_orphan_messages_seen
  ON public.wpp_orphan_messages(last_seen_at DESC);

ALTER TABLE public.wpp_orphan_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read wpp_orphan_messages"
  ON public.wpp_orphan_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage wpp_orphan_messages"
  ON public.wpp_orphan_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
