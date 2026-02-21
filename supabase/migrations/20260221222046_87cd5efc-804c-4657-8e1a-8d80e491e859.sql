
-- Fleet Provider Configuration (one per tenant)
CREATE TABLE public.fleet_provider_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  provider_name TEXT NOT NULL DEFAULT 'traccar',
  api_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider_name)
);

ALTER TABLE public.fleet_provider_configs ENABLE ROW LEVEL SECURITY;

-- Only tenant admins can manage configs
CREATE POLICY "Tenant members can read fleet config"
  ON public.fleet_provider_configs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Tenant admins can insert fleet config"
  ON public.fleet_provider_configs FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can update fleet config"
  ON public.fleet_provider_configs FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can delete fleet config"
  ON public.fleet_provider_configs FOR DELETE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner', 'admin')
    )
  );

-- Auto-update timestamp
CREATE TRIGGER update_fleet_provider_configs_updated_at
  BEFORE UPDATE ON public.fleet_provider_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
