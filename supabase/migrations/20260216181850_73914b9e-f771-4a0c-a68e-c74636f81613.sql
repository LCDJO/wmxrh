
-- CNAE Risk Mapping table
CREATE TABLE public.cnae_risk_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cnae_codigo TEXT NOT NULL,
  grau_risco SMALLINT NOT NULL DEFAULT 2 CHECK (grau_risco BETWEEN 1 AND 4),
  ambiente TEXT NOT NULL DEFAULT 'administrativo',
  exige_pgr BOOLEAN NOT NULL DEFAULT true,
  agentes_risco_provaveis TEXT[] NOT NULL DEFAULT '{}',
  nrs_aplicaveis INTEGER[] NOT NULL DEFAULT '{}',
  description TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cnae_codigo)
);

CREATE INDEX idx_cnae_risk_mappings_tenant ON public.cnae_risk_mappings(tenant_id);
CREATE INDEX idx_cnae_risk_mappings_cnae ON public.cnae_risk_mappings(cnae_codigo);

ALTER TABLE public.cnae_risk_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view CNAE risk mappings"
  ON public.cnae_risk_mappings FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert CNAE risk mappings"
  ON public.cnae_risk_mappings FOR INSERT
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update CNAE risk mappings"
  ON public.cnae_risk_mappings FOR UPDATE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete CNAE risk mappings"
  ON public.cnae_risk_mappings FOR DELETE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_cnae_risk_mappings_updated_at
  BEFORE UPDATE ON public.cnae_risk_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
