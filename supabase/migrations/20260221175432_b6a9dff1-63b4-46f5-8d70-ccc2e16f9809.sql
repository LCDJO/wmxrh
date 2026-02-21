
-- Add deploy columns to landing_pages
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS subdomain TEXT,
  ADD COLUMN IF NOT EXISTS cloudflare_record_id TEXT,
  ADD COLUMN IF NOT EXISTS deploy_url TEXT,
  ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ;

-- White Label config (superadmin defines per-tenant domain settings)
CREATE TABLE public.white_label_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  domain_principal TEXT NOT NULL,
  cloudflare_zone_id TEXT NOT NULL,
  cloudflare_api_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.white_label_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform superadmins manage white_label_config"
  ON public.white_label_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE platform_users.id = auth.uid()
      AND platform_users.role = 'platform_super_admin'
    )
  );

-- Landing deployments audit log
CREATE TABLE public.landing_deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id),
  subdomain TEXT NOT NULL,
  full_url TEXT NOT NULL,
  cloudflare_record_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  deployed_by UUID,
  deployed_at TIMESTAMPTZ DEFAULT now(),
  removed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view deployments"
  ON public.landing_deployments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE platform_users.id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can manage deployments"
  ON public.landing_deployments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE platform_users.id = auth.uid()
      AND platform_users.role IN ('platform_super_admin', 'platform_operations', 'platform_marketing_team', 'platform_marketing_director')
    )
  );

CREATE TRIGGER update_white_label_config_updated_at
  BEFORE UPDATE ON public.white_label_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
