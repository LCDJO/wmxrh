-- Webhook configurations table for managing webhook secrets and parameters
CREATE TABLE public.webhook_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  webhook_name TEXT NOT NULL,
  webhook_url TEXT,
  secret_value TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  provider TEXT,
  headers JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, webhook_name)
);

ALTER TABLE public.webhook_configurations ENABLE ROW LEVEL SECURITY;

-- Only tenant admins can manage webhook configurations
CREATE POLICY "Tenant admins can view webhook configs"
  ON public.webhook_configurations FOR SELECT
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert webhook configs"
  ON public.webhook_configurations FOR INSERT
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update webhook configs"
  ON public.webhook_configurations FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete webhook configs"
  ON public.webhook_configurations FOR DELETE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Auto-update timestamp
CREATE TRIGGER update_webhook_configurations_updated_at
  BEFORE UPDATE ON public.webhook_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
