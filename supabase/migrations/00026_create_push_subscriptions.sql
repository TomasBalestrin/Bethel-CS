-- Push notification subscriptions (VAPID / Web Push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Para especialistas/admin logados:
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  -- Para mentorados (página pública):
  mentee_id uuid REFERENCES mentees(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  -- Um dos dois deve estar preenchido
  CONSTRAINT check_owner CHECK (
    (user_id IS NOT NULL AND mentee_id IS NULL) OR
    (user_id IS NULL AND mentee_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_mentee_id
  ON public.push_subscriptions(mentee_id);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem gerenciar suas próprias subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anon pode inserir/deletar subscriptions de mentorados (página pública)
CREATE POLICY "Anon manage mentee push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (mentee_id IS NOT NULL)
  WITH CHECK (mentee_id IS NOT NULL);
