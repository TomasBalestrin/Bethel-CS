-- Add business fields to mentees table for AI extraction from action plans
ALTER TABLE public.mentees ADD COLUMN IF NOT EXISTS nome_empresa text;
ALTER TABLE public.mentees ADD COLUMN IF NOT EXISTS num_colaboradores integer;
