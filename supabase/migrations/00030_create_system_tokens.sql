-- System tokens for serverless JWT persistence (Next Apps auth)
CREATE TABLE IF NOT EXISTS public.system_tokens (
  key text PRIMARY KEY,
  value text NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- No RLS policies = only service role can access (bypass RLS)
ALTER TABLE public.system_tokens ENABLE ROW LEVEL SECURITY;
