-- Observabilidade: registra INSERTs que falham em wpp_messages / call_records
-- / forwarding_notifications etc. A ideia é ter um lugar pra admin ver o
-- que está quebrando sem precisar abrir o log do Vercel (que rotaciona).
--
-- Populada pelas rotas de webhook/send/forward em src/app/api/whatsapp/** e
-- /api/calls/** através do helper src/lib/log-insert-error.ts.
CREATE TABLE IF NOT EXISTS public.wpp_insert_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  route text NOT NULL,
  target_table text NOT NULL,
  error_code text,
  error_message text NOT NULL,
  error_details text,
  error_hint text,
  mentee_id uuid REFERENCES public.mentees(id) ON DELETE SET NULL,
  specialist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_wpp_insert_errors_occurred_at
  ON public.wpp_insert_errors(occurred_at DESC);

ALTER TABLE public.wpp_insert_errors ENABLE ROW LEVEL SECURITY;

-- Só admin lê (não vaza payloads sensíveis para especialistas).
CREATE POLICY "Admin lê wpp_insert_errors"
  ON public.wpp_insert_errors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Writes só via service role (admin client das rotas de API) — não precisamos
-- de policy de INSERT pra authenticated; o admin client bypassa RLS.
