-- WhatsApp messages history
CREATE TABLE IF NOT EXISTS public.wpp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid REFERENCES mentees(id) ON DELETE CASCADE,
  specialist_id uuid REFERENCES profiles(id),
  instance_id text NOT NULL,
  message_id text UNIQUE,
  direction text NOT NULL
    CHECK (direction IN ('incoming','outgoing')),
  message_type text NOT NULL
    CHECK (message_type IN ('text','image','audio','video','document','location','sticker')),
  content text,
  media_url text,
  sender_name text,
  is_read boolean DEFAULT false,
  sent_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_messages_mentee
  ON public.wpp_messages(mentee_id);
CREATE INDEX IF NOT EXISTS idx_wpp_messages_sent_at
  ON public.wpp_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wpp_messages_unread
  ON public.wpp_messages(mentee_id, is_read)
  WHERE is_read = false;

-- RLS
ALTER TABLE public.wpp_messages ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access wpp_messages"
  ON public.wpp_messages FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Specialist manage own mentee messages
CREATE POLICY "Specialist manage own mentee messages"
  ON public.wpp_messages FOR ALL
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());
