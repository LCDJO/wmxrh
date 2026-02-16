
-- Add missing columns to training_requirements
ALTER TABLE public.training_requirements
  ADD COLUMN IF NOT EXISTS condicional_por_risco boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grau_risco_minimo integer NOT NULL DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN public.training_requirements.condicional_por_risco IS 'True if this NR requirement only applies when company risk grade >= grau_risco_minimo';
COMMENT ON COLUMN public.training_requirements.grau_risco_minimo IS 'Minimum risk grade (1-4) for this requirement to be mandatory';
