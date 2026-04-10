-- Configurable chat channel names for admin
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default channel
INSERT INTO public.chat_channels (slug, label, position, is_default)
VALUES ('principal', 'Principal', 0, true)
ON CONFLICT (slug) DO NOTHING;

-- RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chat_channels"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage chat_channels"
  ON public.chat_channels FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
