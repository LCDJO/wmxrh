
-- Company CNAE Profiles (CNPJ Data Resolver)
CREATE TABLE public.company_cnae_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  cnae_principal TEXT NOT NULL,
  cnaes_secundarios TEXT[] NOT NULL DEFAULT '{}',
  descricao_atividade TEXT NOT NULL DEFAULT '',
  grau_risco_sugerido SMALLINT NOT NULL DEFAULT 2 CHECK (grau_risco_sugerido BETWEEN 1 AND 4),
  resolved_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, company_id)
);

-- Index
CREATE INDEX idx_company_cnae_profiles_tenant ON public.company_cnae_profiles(tenant_id);
CREATE INDEX idx_company_cnae_profiles_cnpj ON public.company_cnae_profiles(cnpj);

-- RLS
ALTER TABLE public.company_cnae_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view CNAE profiles"
  ON public.company_cnae_profiles FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert CNAE profiles"
  ON public.company_cnae_profiles FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update CNAE profiles"
  ON public.company_cnae_profiles FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_company_cnae_profiles_updated_at
  BEFORE UPDATE ON public.company_cnae_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
