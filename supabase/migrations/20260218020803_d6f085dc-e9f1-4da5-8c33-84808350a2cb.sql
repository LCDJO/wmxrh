
-- Sandbox preview sessions for support_module per-tenant version testing
CREATE TABLE public.support_sandbox_previews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  module_id TEXT NOT NULL DEFAULT 'support_module',
  version_id UUID NOT NULL REFERENCES public.support_module_versions(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'concluded', 'aborted')),
  feature_flags_override JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_by TEXT NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluded_at TIMESTAMPTZ,
  conclusion_notes TEXT,
  promoted BOOLEAN NOT NULL DEFAULT false
);

-- Only one active preview per tenant+module
CREATE UNIQUE INDEX idx_sandbox_one_active_per_tenant
  ON public.support_sandbox_previews (tenant_id, module_id)
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.support_sandbox_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can read sandbox previews"
  ON public.support_sandbox_previews FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can manage sandbox previews"
  ON public.support_sandbox_previews FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));
