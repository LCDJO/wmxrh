
CREATE TABLE public.federation_role_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idp_config_id UUID NOT NULL REFERENCES public.identity_provider_configs(id) ON DELETE CASCADE,
  idp_group_name TEXT NOT NULL,
  idp_group_id TEXT,
  target_scope TEXT NOT NULL CHECK (target_scope IN ('platform', 'tenant')),
  platform_role_id UUID REFERENCES public.platform_roles(id) ON DELETE CASCADE,
  tenant_role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  auto_provision BOOLEAN NOT NULL DEFAULT true,
  auto_deprovision BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_target_check CHECK (
    (target_scope = 'platform' AND platform_role_id IS NOT NULL)
    OR (target_scope = 'tenant' AND tenant_role IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_fed_role_map_unique
  ON public.federation_role_mappings(idp_config_id, idp_group_name, target_scope, COALESCE(platform_role_id::text, ''), COALESCE(tenant_role, ''));
CREATE INDEX idx_fed_role_map_idp ON public.federation_role_mappings(idp_config_id) WHERE is_active = true;
CREATE INDEX idx_fed_role_map_tenant ON public.federation_role_mappings(tenant_id);

ALTER TABLE public.federation_role_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role mappings"
  ON public.federation_role_mappings
  FOR ALL
  TO authenticated
  USING (
    public.has_platform_role(auth.uid(), 'platform_super_admin')
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = federation_role_mappings.tenant_id
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    public.has_platform_role(auth.uid(), 'platform_super_admin')
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = federation_role_mappings.tenant_id
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role manages role mappings"
  ON public.federation_role_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_federation_role_mappings_updated_at
  BEFORE UPDATE ON public.federation_role_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
