-- Corrige a FK mentee_id em 3 tabelas da migração 00042: a definição original
-- tem ON DELETE CASCADE, mas em produção as tabelas foram criadas antes sem
-- CASCADE (provavelmente manualmente) e o CREATE TABLE IF NOT EXISTS não
-- recriou. Resultado: delete de mentorado era rejeitado pela FK.
--
-- Este patch faz DROP + ADD da mesma constraint com ON DELETE CASCADE em
-- todas as 3 tabelas. Idempotente: roda de novo não quebra.

-- presential_events
ALTER TABLE public.presential_events
  DROP CONSTRAINT IF EXISTS presential_events_mentee_id_fkey;
ALTER TABLE public.presential_events
  ADD CONSTRAINT presential_events_mentee_id_fkey
  FOREIGN KEY (mentee_id) REFERENCES public.mentees(id) ON DELETE CASCADE;

-- individual_sessions
ALTER TABLE public.individual_sessions
  DROP CONSTRAINT IF EXISTS individual_sessions_mentee_id_fkey;
ALTER TABLE public.individual_sessions
  ADD CONSTRAINT individual_sessions_mentee_id_fkey
  FOREIGN KEY (mentee_id) REFERENCES public.mentees(id) ON DELETE CASCADE;

-- extra_deliveries
ALTER TABLE public.extra_deliveries
  DROP CONSTRAINT IF EXISTS extra_deliveries_mentee_id_fkey;
ALTER TABLE public.extra_deliveries
  ADD CONSTRAINT extra_deliveries_mentee_id_fkey
  FOREIGN KEY (mentee_id) REFERENCES public.mentees(id) ON DELETE CASCADE;
