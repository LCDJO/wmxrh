
-- eSocial Governance Audit Log (append-only)
CREATE TABLE public.esocial_governance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  empresa_id UUID REFERENCES public.companies(id),
  acao TEXT NOT NULL,
  evento TEXT,
  status TEXT NOT NULL DEFAULT 'info',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast tenant+time queries
CREATE INDEX idx_esocial_gov_logs_tenant_time ON public.esocial_governance_logs(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.esocial_governance_logs ENABLE ROW LEVEL SECURITY;

-- Append-only: users can INSERT and SELECT only
CREATE POLICY "Tenant users can view own logs"
  ON public.esocial_governance_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE id = auth.uid()));

CREATE POLICY "Tenant users can insert own logs"
  ON public.esocial_governance_logs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE id = auth.uid()));

-- No UPDATE or DELETE policies → immutable audit trail
