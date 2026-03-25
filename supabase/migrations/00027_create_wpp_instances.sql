-- WhatsApp instances (one per specialist)
CREATE TABLE IF NOT EXISTS public.wpp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  instance_id text NOT NULL UNIQUE,
  phone_number text,
  status text DEFAULT 'disconnected'
    CHECK (status IN ('connected','disconnected','connecting')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_instances_specialist
  ON public.wpp_instances(specialist_id);
CREATE INDEX IF NOT EXISTS idx_wpp_instances_instance_id
  ON public.wpp_instances(instance_id);

-- RLS
ALTER TABLE public.wpp_instances ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access wpp_instances"
  ON public.wpp_instances FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Specialist read own instance
CREATE POLICY "Specialist read own wpp_instance"
  ON public.wpp_instances FOR SELECT
  USING (specialist_id = auth.uid());
