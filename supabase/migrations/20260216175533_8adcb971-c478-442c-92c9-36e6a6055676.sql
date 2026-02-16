
-- Add missing columns to agreement_templates for simplified domain model
ALTER TABLE public.agreement_templates
  ADD COLUMN IF NOT EXISTS cargo_id UUID REFERENCES public.positions(id),
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conteudo_html TEXT NOT NULL DEFAULT '';

-- Update category default to match new tipo enum values
COMMENT ON COLUMN public.agreement_templates.category IS 'tipo: geral | funcao | empresa | risco';
