-- Add new columns to agreement_templates for governance engine
ALTER TABLE public.agreement_templates
  ADD COLUMN IF NOT EXISTS cbo_codigo TEXT,
  ADD COLUMN IF NOT EXISTS escopo TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS exige_assinatura BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS renovacao_obrigatoria BOOLEAN NOT NULL DEFAULT false;

-- Add index for escopo + category queries
CREATE INDEX IF NOT EXISTS idx_agreement_templates_escopo ON public.agreement_templates(escopo);
CREATE INDEX IF NOT EXISTS idx_agreement_templates_cbo ON public.agreement_templates(cbo_codigo) WHERE cbo_codigo IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.agreement_templates.escopo IS 'global | cargo | risco | funcao_especifica';
COMMENT ON COLUMN public.agreement_templates.cbo_codigo IS 'CBO code for function-specific templates';
COMMENT ON COLUMN public.agreement_templates.exige_assinatura IS 'Whether digital signature is required';
COMMENT ON COLUMN public.agreement_templates.renovacao_obrigatoria IS 'Whether periodic renewal is mandatory';
