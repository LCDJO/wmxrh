
-- Tenant custom domains for multi-tenant resolution
CREATE TABLE public.tenant_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  domain_type TEXT NOT NULL DEFAULT 'custom' CHECK (domain_type IN ('custom', 'subdomain')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_token TEXT,
  ssl_status TEXT NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain)
);

CREATE INDEX idx_tenant_domains_domain ON public.tenant_domains(domain) WHERE is_verified = true;
CREATE INDEX idx_tenant_domains_tenant ON public.tenant_domains(tenant_id);

ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage domains"
  ON public.tenant_domains
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_domains.tenant_id
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_domains.tenant_id
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Public read for domain resolution (unauthenticated users need this to find their tenant)
CREATE POLICY "Anyone can resolve verified domains"
  ON public.tenant_domains
  FOR SELECT
  TO anon, authenticated
  USING (is_verified = true);

CREATE POLICY "Service role full access"
  ON public.tenant_domains
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_tenant_domains_updated_at
  BEFORE UPDATE ON public.tenant_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add slug column to tenants for subdomain resolution
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug) WHERE slug IS NOT NULL;
