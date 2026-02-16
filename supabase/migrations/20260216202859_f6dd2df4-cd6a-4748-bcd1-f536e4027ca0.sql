
-- Tenant module activation tracking
CREATE TABLE public.tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_by UUID REFERENCES auth.users(id),
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can select tenant modules"
  ON public.tenant_modules FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()));

CREATE POLICY "Platform super admin/ops can insert tenant modules"
  ON public.tenant_modules FOR INSERT TO authenticated
  WITH CHECK (
    public.has_platform_role(auth.uid(), 'platform_super_admin')
    OR public.has_platform_role(auth.uid(), 'platform_operations')
  );

CREATE POLICY "Platform super admin/ops can update tenant modules"
  ON public.tenant_modules FOR UPDATE TO authenticated
  USING (
    public.has_platform_role(auth.uid(), 'platform_super_admin')
    OR public.has_platform_role(auth.uid(), 'platform_operations')
  );

CREATE POLICY "Tenant users can view own modules"
  ON public.tenant_modules FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

CREATE TRIGGER update_tenant_modules_updated_at
  BEFORE UPDATE ON public.tenant_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tenant_modules_tenant_id ON public.tenant_modules(tenant_id);

-- Platform users can manage tenants table
CREATE POLICY "Platform users can select all tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()));

CREATE POLICY "Platform super admin/ops can insert tenants"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (
    public.has_platform_role(auth.uid(), 'platform_super_admin')
    OR public.has_platform_role(auth.uid(), 'platform_operations')
  );

CREATE POLICY "Platform super admin/ops can update tenants"
  ON public.tenants FOR UPDATE TO authenticated
  USING (
    public.has_platform_role(auth.uid(), 'platform_super_admin')
    OR public.has_platform_role(auth.uid(), 'platform_operations')
  );
