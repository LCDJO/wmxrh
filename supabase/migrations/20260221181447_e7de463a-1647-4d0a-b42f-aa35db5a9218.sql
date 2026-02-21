
-- Meta Ads OAuth connections per tenant
CREATE TABLE public.meta_ads_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  pixel_id TEXT,
  page_id TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(tenant_id)
);

ALTER TABLE public.meta_ads_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage meta connections"
  ON public.meta_ads_connections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.id = auth.uid()
      AND pu.role IN ('platform_super_admin', 'platform_operations', 'platform_marketing_director', 'platform_marketing_team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.id = auth.uid()
      AND pu.role IN ('platform_super_admin', 'platform_operations', 'platform_marketing_director', 'platform_marketing_team')
    )
  );

-- Meta Ad Campaigns tracking
CREATE TABLE public.meta_ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating',
  daily_budget_cents INTEGER NOT NULL DEFAULT 1000,
  targeting JSONB DEFAULT '{}',
  created_by UUID NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage meta campaigns"
  ON public.meta_ad_campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.id = auth.uid()
      AND pu.role IN ('platform_super_admin', 'platform_operations', 'platform_marketing_director', 'platform_marketing_team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.id = auth.uid()
      AND pu.role IN ('platform_super_admin', 'platform_operations', 'platform_marketing_director', 'platform_marketing_team')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_meta_ads_connections_updated_at
  BEFORE UPDATE ON public.meta_ads_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_ad_campaigns_updated_at
  BEFORE UPDATE ON public.meta_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
