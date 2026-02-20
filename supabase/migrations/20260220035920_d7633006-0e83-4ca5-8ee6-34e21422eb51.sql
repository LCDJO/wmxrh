
-- Legal Knowledge Base — LegalReference table
CREATE TABLE public.legal_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('NR','CLT','CCT','Portaria')),
  codigo_referencia TEXT NOT NULL,
  resumo TEXT,
  obrigatoriedade BOOLEAN NOT NULL DEFAULT false,
  categoria_profissional TEXT,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for legal_references" ON public.legal_references
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE INDEX idx_legal_references_tipo ON public.legal_references(tenant_id, tipo);
CREATE INDEX idx_legal_references_codigo ON public.legal_references(tenant_id, codigo_referencia);

CREATE TRIGGER update_legal_references_updated_at BEFORE UPDATE ON public.legal_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
