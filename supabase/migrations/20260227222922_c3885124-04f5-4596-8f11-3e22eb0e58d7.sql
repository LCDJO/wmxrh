
-- ══════════════════════════════════════════════════════════════
-- SCIM 2.0 Provisioning Engine — Database Schema
-- ══════════════════════════════════════════════════════════════

-- 1. SCIM Clients — IdPs or directories that push user/group data
CREATE TABLE public.scim_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  bearer_token_hash text NOT NULL,
  identity_provider_id uuid REFERENCES public.identity_provider_configs(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  base_url text,
  sync_direction text NOT NULL DEFAULT 'inbound' CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),
  supported_resources text[] NOT NULL DEFAULT ARRAY['User', 'Group'],
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scim_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage SCIM clients"
ON public.scim_clients FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = scim_clients.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

-- 2. SCIM Attribute Mappings — Maps SCIM schema attributes to internal fields
CREATE TABLE public.scim_attribute_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scim_client_id uuid NOT NULL REFERENCES public.scim_clients(id) ON DELETE CASCADE,
  resource_type text NOT NULL DEFAULT 'User' CHECK (resource_type IN ('User', 'Group')),
  scim_attribute text NOT NULL,
  internal_field text NOT NULL,
  transform_expression text,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scim_client_id, resource_type, scim_attribute)
);

ALTER TABLE public.scim_attribute_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage attribute mappings"
ON public.scim_attribute_mappings FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = scim_attribute_mappings.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

-- 3. SCIM Provisioned Users — Tracks externally provisioned user state
CREATE TABLE public.scim_provisioned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scim_client_id uuid NOT NULL REFERENCES public.scim_clients(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  scim_id text NOT NULL,
  user_id uuid,
  display_name text,
  email text,
  active boolean NOT NULL DEFAULT true,
  scim_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scim_client_id, external_id)
);

ALTER TABLE public.scim_provisioned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins view provisioned users"
ON public.scim_provisioned_users FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = scim_provisioned_users.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

-- 4. SCIM Provisioned Groups — Tracks externally provisioned group state
CREATE TABLE public.scim_provisioned_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scim_client_id uuid NOT NULL REFERENCES public.scim_clients(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  scim_id text NOT NULL,
  display_name text NOT NULL,
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  mapped_role text,
  scim_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scim_client_id, external_id)
);

ALTER TABLE public.scim_provisioned_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins view provisioned groups"
ON public.scim_provisioned_groups FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = scim_provisioned_groups.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

-- 5. SCIM Provisioning Logs — Full audit trail
CREATE TABLE public.scim_provisioning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scim_client_id uuid NOT NULL REFERENCES public.scim_clients(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE', 'PATCH', 'GET', 'LIST', 'BULK')),
  resource_type text NOT NULL CHECK (resource_type IN ('User', 'Group')),
  resource_id text,
  external_id text,
  request_payload jsonb,
  response_status integer NOT NULL,
  response_payload jsonb,
  error_message text,
  ip_address text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scim_provisioning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins view provisioning logs"
ON public.scim_provisioning_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = scim_provisioning_logs.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

-- Platform superadmins can also view all SCIM data for governance
CREATE POLICY "Platform superadmins view all SCIM clients"
ON public.scim_clients FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    JOIN public.platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid() AND pr.name IN ('platform_super_admin', 'platform_operations')
  )
);

CREATE POLICY "Platform superadmins view all provisioning logs"
ON public.scim_provisioning_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    JOIN public.platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid() AND pr.name IN ('platform_super_admin', 'platform_operations')
  )
);

-- Indexes for performance
CREATE INDEX idx_scim_clients_tenant ON public.scim_clients(tenant_id);
CREATE INDEX idx_scim_prov_users_client ON public.scim_provisioned_users(scim_client_id);
CREATE INDEX idx_scim_prov_users_email ON public.scim_provisioned_users(email);
CREATE INDEX idx_scim_prov_groups_client ON public.scim_provisioned_groups(scim_client_id);
CREATE INDEX idx_scim_logs_tenant_created ON public.scim_provisioning_logs(tenant_id, created_at DESC);
CREATE INDEX idx_scim_logs_client ON public.scim_provisioning_logs(scim_client_id);

-- Updated_at triggers
CREATE TRIGGER update_scim_clients_updated_at BEFORE UPDATE ON public.scim_clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scim_attr_mappings_updated_at BEFORE UPDATE ON public.scim_attribute_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scim_prov_users_updated_at BEFORE UPDATE ON public.scim_provisioned_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scim_prov_groups_updated_at BEFORE UPDATE ON public.scim_provisioned_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
