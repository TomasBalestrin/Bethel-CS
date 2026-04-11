-- Grant anon role permissions on action_plans table (needed for public form submission)
-- RLS policies already exist but base table permissions were missing
GRANT SELECT, INSERT, UPDATE ON public.action_plans TO anon;

-- Also grant anon SELECT on mentees (needed to look up by action_plan_token)
GRANT SELECT ON public.mentees TO anon;

-- Grant anon UPDATE on mentees for syncing form data back (cpf, email, etc.)
GRANT UPDATE ON public.mentees TO anon;
