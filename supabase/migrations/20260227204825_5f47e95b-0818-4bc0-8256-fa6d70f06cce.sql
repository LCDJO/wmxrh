
-- ══════════════════════════════════════════════
-- UNIFIED IDENTITY FEDERATION ENGINE (UIFE)
-- Tables for multi-tenant identity federation
-- ══════════════════════════════════════════════

-- Enum for federation protocols
CREATE TYPE public.federation_protocol AS ENUM ('saml', 'oidc', 'oauth2');
CREATE TYPE public.idp_status AS ENUM ('draft', 'active', 'suspended', 'archived');
CREATE TYPE public.federation_session_status AS ENUM ('pending', 'authenticated', 'expired', 'revoked');

-- ── 1. Identity Provider Configurations (per tenant) ──
CREATE TABLE public.identity_provider_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  protocol federation_protocol NOT NULL,
  entity_id TEXT,
  metadata_url TEXT,
  sso_url TEXT,
  slo_url TEXT,
  certificate TEXT,
  issuer_url TEXT,
  client_id TEXT,
  authorization_endpoint TEXT,
  token_endpoint TEXT,
  userinfo_endpoint TEXT,
  jwks_uri TEXT,
  attribute_mapping JSONB NOT NULL DEFAULT '{}',
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',
  auto_provision_users BOOLEAN NOT NULL DEFAULT false,
  default_role TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status idp_status NOT NULL DEFAULT 'draft',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  icon_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_idp_configs_tenant ON public.identity_provider_configs(tenant_id);
CREATE INDEX idx_idp_configs_status ON public.identity_provider_configs(tenant_id, status);
CREATE UNIQUE INDEX idx_idp_configs_entity ON public.identity_provider_configs(tenant_id, entity_id) WHERE entity_id IS NOT NULL;

-- ── 2. Federation Sessions ──
CREATE TABLE public.federation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idp_config_id UUID NOT NULL REFERENCES public.identity_provider_configs(id) ON DELETE CASCADE,
  user_id UUID,
  protocol federation_protocol NOT NULL,
  session_index TEXT,
  name_id TEXT,
  external_subject TEXT,
  attributes JSONB NOT NULL DEFAULT '{}',
  status federation_session_status NOT NULL DEFAULT 'pending',
  ip_address TEXT,
  user_agent TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  authenticated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fed_sessions_tenant ON public.federation_sessions(tenant_id);
CREATE INDEX idx_fed_sessions_user ON public.federation_sessions(user_id);
CREATE INDEX idx_fed_sessions_idp ON public.federation_sessions(idp_config_id);
CREATE INDEX idx_fed_sessions_status ON public.federation_sessions(status) WHERE status = 'authenticated';

-- ── 3. Federation Audit Log ──
CREATE TABLE public.federation_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idp_config_id UUID REFERENCES public.identity_provider_configs(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.federation_sessions(id) ON DELETE SET NULL,
  user_id UUID,
  event_type TEXT NOT NULL,
  protocol federation_protocol,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fed_audit_tenant ON public.federation_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_fed_audit_event ON public.federation_audit_logs(event_type, created_at DESC);

-- ── RLS ──
ALTER TABLE public.identity_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_audit_logs ENABLE ROW LEVEL SECURITY;

-- IdP configs: tenant admins
CREATE POLICY "Tenant admins can manage IdP configs"
  ON public.identity_provider_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = identity_provider_configs.tenant_id
        AND tm.status = 'active'
        AND ur.role IN ('admin', 'tenant_admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = identity_provider_configs.tenant_id
        AND tm.status = 'active'
        AND ur.role IN ('admin', 'tenant_admin', 'owner')
    )
  );

-- Federation sessions: own or admin
CREATE POLICY "Users can read own federation sessions"
  ON public.federation_sessions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = federation_sessions.tenant_id
        AND tm.status = 'active'
        AND ur.role IN ('admin', 'tenant_admin', 'owner')
    )
  );

CREATE POLICY "Service can manage federation sessions"
  ON public.federation_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Audit logs: tenant admins read
CREATE POLICY "Tenant admins can read federation audit"
  ON public.federation_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = federation_audit_logs.tenant_id
        AND tm.status = 'active'
        AND ur.role IN ('admin', 'tenant_admin', 'owner')
    )
  );

CREATE POLICY "Service can insert federation audit"
  ON public.federation_audit_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Trigger
CREATE TRIGGER update_idp_configs_updated_at
  BEFORE UPDATE ON public.identity_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
