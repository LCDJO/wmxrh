
-- Add weekly hours to collective agreements
ALTER TABLE public.collective_agreements
  ADD COLUMN jornada_semanal NUMERIC,
  ADD COLUMN regras_extras JSONB DEFAULT '{}';

COMMENT ON COLUMN public.collective_agreements.jornada_semanal IS 'Jornada semanal definida pela CCT (ex: 44, 40, 36)';
COMMENT ON COLUMN public.collective_agreements.regras_extras IS 'Regras adicionais da CCT em formato JSON livre';

-- Link company to active convention
ALTER TABLE public.companies
  ADD COLUMN active_agreement_id UUID REFERENCES public.collective_agreements(id);

CREATE INDEX idx_companies_active_agreement ON public.companies(active_agreement_id);

COMMENT ON COLUMN public.companies.active_agreement_id IS 'CCT/ACT ativa vinculada à empresa';
