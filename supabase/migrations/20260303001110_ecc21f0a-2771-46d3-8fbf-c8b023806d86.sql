
-- Branding version history for rollback support
CREATE TABLE public.tenant_branding_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version_id INTEGER NOT NULL,
  snapshot_config JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version_id)
);

ALTER TABLE public.tenant_branding_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view branding versions"
  ON public.tenant_branding_versions FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert branding versions"
  ON public.tenant_branding_versions FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX idx_branding_versions_tenant ON public.tenant_branding_versions(tenant_id, version_id DESC);
