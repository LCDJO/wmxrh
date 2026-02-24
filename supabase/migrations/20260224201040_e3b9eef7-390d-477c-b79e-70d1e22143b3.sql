
-- Table for tenant-scoped integration configurations (Traccar, etc.)
CREATE TABLE public.tenant_integration_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_key TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration_key)
);

ALTER TABLE public.tenant_integration_configs ENABLE ROW LEVEL SECURITY;

-- Only tenant members can view their configs
CREATE POLICY "Tenant members can view configs"
  ON public.tenant_integration_configs FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Only tenant admins (owner/admin) can insert
CREATE POLICY "Tenant admins can insert configs"
  ON public.tenant_integration_configs FOR INSERT
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

-- Only tenant admins can update
CREATE POLICY "Tenant admins can update configs"
  ON public.tenant_integration_configs FOR UPDATE
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Only tenant admins can delete
CREATE POLICY "Tenant admins can delete configs"
  ON public.tenant_integration_configs FOR DELETE
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_tenant_integration_configs_updated_at
  BEFORE UPDATE ON public.tenant_integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
