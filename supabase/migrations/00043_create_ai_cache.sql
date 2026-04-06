-- AI response cache to reduce API costs
CREATE TABLE ai_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text UNIQUE NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Index for fast lookups and TTL cleanup
CREATE INDEX idx_ai_cache_key ON ai_cache (cache_key);
CREATE INDEX idx_ai_cache_expires ON ai_cache (expires_at) WHERE expires_at IS NOT NULL;

-- RLS: only authenticated users can read/write
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_cache"
  ON ai_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ai_cache"
  ON ai_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete expired ai_cache"
  ON ai_cache FOR DELETE
  TO authenticated
  USING (expires_at IS NOT NULL AND expires_at < now());
