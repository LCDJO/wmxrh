
-- CBO Catalog
CREATE TABLE public.cbo_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cbo_codigo TEXT NOT NULL,
  nome_funcao TEXT NOT NULL,
  descricao TEXT,
  area_ocupacional TEXT,
  nrs_relacionadas INTEGER[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cbo_codigo)
);

CREATE INDEX idx_cbo_catalog_tenant ON public.cbo_catalog(tenant_id);

ALTER TABLE public.cbo_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view CBO catalog"
  ON public.cbo_catalog FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert CBO catalog"
  ON public.cbo_catalog FOR INSERT
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update CBO catalog"
  ON public.cbo_catalog FOR UPDATE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete CBO catalog"
  ON public.cbo_catalog FOR DELETE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_cbo_catalog_updated_at
  BEFORE UPDATE ON public.cbo_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CNAE → CBO Mapping
CREATE TABLE public.cnae_cbo_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cnae_codigo TEXT NOT NULL,
  cbo_codigo TEXT NOT NULL,
  probabilidade NUMERIC NOT NULL DEFAULT 0.5 CHECK (probabilidade >= 0 AND probabilidade <= 1),
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'engine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cnae_codigo, cbo_codigo)
);

CREATE INDEX idx_cnae_cbo_mappings_tenant ON public.cnae_cbo_mappings(tenant_id);
CREATE INDEX idx_cnae_cbo_mappings_cnae ON public.cnae_cbo_mappings(cnae_codigo);

ALTER TABLE public.cnae_cbo_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view CNAE CBO mappings"
  ON public.cnae_cbo_mappings FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert CNAE CBO mappings"
  ON public.cnae_cbo_mappings FOR INSERT
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update CNAE CBO mappings"
  ON public.cnae_cbo_mappings FOR UPDATE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete CNAE CBO mappings"
  ON public.cnae_cbo_mappings FOR DELETE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_cnae_cbo_mappings_updated_at
  BEFORE UPDATE ON public.cnae_cbo_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
