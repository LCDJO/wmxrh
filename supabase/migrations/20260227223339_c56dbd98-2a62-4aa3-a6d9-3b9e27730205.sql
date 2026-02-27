
-- Tenant-level SCIM configuration (one per tenant)
CREATE TABLE public.scim_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  base_url text,
  default_attribute_mapping jsonb NOT NULL DEFAULT '{
    "userName": "email",
    "displayName": "display_name",
    "name.givenName": "first_name",
    "name.familyName": "last_name",
    "emails[0].value": "email",
    "active": "active",
    "externalId": "external_id"
  }'::jsonb,
  role_mapping_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_create_users boolean NOT NULL DEFAULT true,
  auto_deactivate_users boolean NOT NULL DEFAULT true,
  sync_groups_to_roles boolean NOT NULL DEFAULT true,
  default_role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scim_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage SCIM config"
ON public.scim_configs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = scim_configs.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Platform admins view all SCIM configs"
ON public.scim_configs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    JOIN public.platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid() AND pr.name IN ('platform_super_admin', 'platform_operations')
  )
);

CREATE TRIGGER update_scim_configs_updated_at
BEFORE UPDATE ON public.scim_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_scim_configs_tenant ON public.scim_configs(tenant_id);
