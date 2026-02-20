
CREATE TABLE public.career_legal_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  career_position_id UUID NOT NULL REFERENCES public.career_positions(id) ON DELETE CASCADE,
  legal_reference_id UUID REFERENCES public.legal_references(id),
  nr_codigo TEXT,
  exige_treinamento BOOLEAN NOT NULL DEFAULT false,
  exige_exame_medico BOOLEAN NOT NULL DEFAULT false,
  exige_epi BOOLEAN NOT NULL DEFAULT false,
  adicional_aplicavel TEXT CHECK (adicional_aplicavel IN ('insalubridade','periculosidade')),
  piso_salarial_referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.career_legal_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_legal_mappings" ON public.career_legal_mappings
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE INDEX idx_career_legal_mappings_position ON public.career_legal_mappings(tenant_id, career_position_id);
CREATE INDEX idx_career_legal_mappings_nr ON public.career_legal_mappings(tenant_id, nr_codigo);

CREATE TRIGGER update_career_legal_mappings_updated_at BEFORE UPDATE ON public.career_legal_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
