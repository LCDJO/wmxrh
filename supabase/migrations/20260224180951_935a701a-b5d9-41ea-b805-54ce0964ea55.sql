
-- Footer configuration per tenant
CREATE TABLE public.footer_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  show_institutional BOOLEAN NOT NULL DEFAULT true,
  show_compliance BOOLEAN NOT NULL DEFAULT true,
  show_support BOOLEAN NOT NULL DEFAULT true,
  show_technical BOOLEAN NOT NULL DEFAULT true,
  show_bottom_text BOOLEAN NOT NULL DEFAULT true,
  custom_bottom_text TEXT,
  support_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.footer_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view footer config"
  ON public.footer_configs FOR SELECT
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage footer config"
  ON public.footer_configs FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_custom_roles ucr ON ucr.user_id = tm.user_id AND ucr.tenant_id = tm.tenant_id
    JOIN public.custom_roles cr ON cr.id = ucr.role_id
    WHERE tm.user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));
