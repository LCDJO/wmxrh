
-- ============================================================
-- PLATFORM API MANAGEMENT SYSTEM (PAMS) — Database Schema
-- ============================================================

-- 1. API Clients (applications/integrations that consume APIs)
CREATE TABLE public.api_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  client_type TEXT NOT NULL DEFAULT 'external' CHECK (client_type IN ('external', 'internal', 'partner', 'sandbox')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'pending_approval')),
  contact_email TEXT,
  webhook_url TEXT,
  allowed_origins TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. API Keys (credentials for clients)
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,  -- first 8 chars for identification (e.g. "pams_k1_")
  key_hash TEXT NOT NULL,     -- SHA-256 hash of the full key
  name TEXT NOT NULL DEFAULT 'Default Key',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked', 'expired')),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'sandbox')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  usage_count BIGINT NOT NULL DEFAULT 0,
  rate_limit_override INTEGER,  -- per-key override (requests/minute)
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoked_reason TEXT
);

-- 3. API Scopes (fine-grained permission definitions)
CREATE TABLE public.api_scopes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,          -- e.g. "employees:read", "payroll:simulate"
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'data',  -- data, action, admin
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. API Rate Limit Configurations (per plan/tier)
CREATE TABLE public.api_rate_limit_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_tier TEXT NOT NULL,  -- matches saas_plans tier
  scope_pattern TEXT NOT NULL DEFAULT '*',  -- scope pattern (e.g. "employees:*")
  requests_per_minute INTEGER NOT NULL DEFAULT 60,
  requests_per_hour INTEGER NOT NULL DEFAULT 1000,
  requests_per_day INTEGER NOT NULL DEFAULT 10000,
  burst_limit INTEGER NOT NULL DEFAULT 10,
  concurrent_limit INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_tier, scope_pattern)
);

-- 5. API Usage Logs (request-level tracking)
CREATE TABLE public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.api_clients(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  request_scope TEXT,
  ip_address TEXT,
  user_agent TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. API Versions (version registry for API endpoints)
CREATE TABLE public.api_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,          -- e.g. "v1", "v2"
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'sunset', 'beta')),
  release_notes TEXT,
  deprecated_at TIMESTAMPTZ,
  sunset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version)
);

-- 7. API Analytics Aggregates (hourly rollups for dashboards)
CREATE TABLE public.api_analytics_aggregates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.api_clients(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'hourly' CHECK (period_type IN ('hourly', 'daily', 'monthly')),
  total_requests BIGINT NOT NULL DEFAULT 0,
  successful_requests BIGINT NOT NULL DEFAULT 0,
  failed_requests BIGINT NOT NULL DEFAULT 0,
  avg_response_time_ms NUMERIC,
  p95_response_time_ms NUMERIC,
  p99_response_time_ms NUMERIC,
  rate_limited_requests BIGINT NOT NULL DEFAULT 0,
  unique_endpoints INTEGER NOT NULL DEFAULT 0,
  top_endpoints JSONB DEFAULT '[]',
  error_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_id, period_start, period_type)
);

-- ── Indexes ──
CREATE INDEX idx_api_clients_tenant ON public.api_clients(tenant_id);
CREATE INDEX idx_api_keys_client ON public.api_keys(client_id);
CREATE INDEX idx_api_keys_tenant ON public.api_keys(tenant_id);
CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_usage_logs_tenant ON public.api_usage_logs(tenant_id);
CREATE INDEX idx_api_usage_logs_created ON public.api_usage_logs(created_at DESC);
CREATE INDEX idx_api_usage_logs_client ON public.api_usage_logs(client_id);
CREATE INDEX idx_api_analytics_period ON public.api_analytics_aggregates(tenant_id, period_start DESC);

-- ── RLS ──
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limit_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_analytics_aggregates ENABLE ROW LEVEL SECURITY;

-- API Clients: tenant admins only
CREATE POLICY "Tenant admins manage api_clients"
  ON public.api_clients FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- API Keys: tenant admins only
CREATE POLICY "Tenant admins manage api_keys"
  ON public.api_keys FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- API Scopes: all authenticated can read (system definitions)
CREATE POLICY "Authenticated users can read api_scopes"
  ON public.api_scopes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Platform users manage scopes
CREATE POLICY "Platform users manage api_scopes"
  ON public.api_scopes FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Rate Limit Configs: platform users only
CREATE POLICY "Platform users manage rate_limit_configs"
  ON public.api_rate_limit_configs FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Rate Limit Configs: authenticated can read
CREATE POLICY "Authenticated read rate_limit_configs"
  ON public.api_rate_limit_configs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Usage Logs: tenant admins can view their own
CREATE POLICY "Tenant admins view api_usage_logs"
  ON public.api_usage_logs FOR SELECT
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Usage Logs: insert from service role only (edge functions)
CREATE POLICY "Service insert api_usage_logs"
  ON public.api_usage_logs FOR INSERT
  WITH CHECK (true);

-- API Versions: authenticated can read
CREATE POLICY "Authenticated read api_versions"
  ON public.api_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Platform users manage versions
CREATE POLICY "Platform users manage api_versions"
  ON public.api_versions FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Analytics: tenant admins view their own
CREATE POLICY "Tenant admins view api_analytics"
  ON public.api_analytics_aggregates FOR SELECT
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Platform users view all analytics
CREATE POLICY "Platform users view all analytics"
  ON public.api_analytics_aggregates FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

-- ── Triggers ──
CREATE TRIGGER update_api_clients_updated_at
  BEFORE UPDATE ON public.api_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_rate_limit_configs_updated_at
  BEFORE UPDATE ON public.api_rate_limit_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_versions_updated_at
  BEFORE UPDATE ON public.api_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Seed default scopes ──
INSERT INTO public.api_scopes (code, name, description, category, risk_level, requires_approval) VALUES
  ('employees:read', 'Read Employees', 'List and view employee data', 'data', 'medium', false),
  ('employees:write', 'Write Employees', 'Create and update employee records', 'data', 'high', true),
  ('compensation:read', 'Read Compensation', 'View salary and benefits data', 'data', 'high', true),
  ('compensation:write', 'Write Compensation', 'Modify salary and benefits', 'data', 'critical', true),
  ('departments:read', 'Read Departments', 'List departments', 'data', 'low', false),
  ('departments:write', 'Write Departments', 'Manage departments', 'data', 'medium', false),
  ('positions:read', 'Read Positions', 'List positions/roles', 'data', 'low', false),
  ('positions:write', 'Write Positions', 'Manage positions', 'data', 'medium', false),
  ('health:read', 'Read Health Data', 'View occupational health records', 'data', 'high', true),
  ('health:write', 'Write Health Data', 'Manage health records', 'data', 'critical', true),
  ('compliance:read', 'Read Compliance', 'View compliance status', 'data', 'medium', false),
  ('payroll:simulate', 'Simulate Payroll', 'Run payroll simulations', 'action', 'medium', false),
  ('reports:generate', 'Generate Reports', 'Generate data reports', 'action', 'medium', false),
  ('webhooks:manage', 'Manage Webhooks', 'Configure webhook endpoints', 'admin', 'high', true),
  ('api_keys:manage', 'Manage API Keys', 'Create and revoke API keys', 'admin', 'critical', true)
ON CONFLICT (code) DO NOTHING;

-- ── Seed default rate limits ──
INSERT INTO public.api_rate_limit_configs (plan_tier, scope_pattern, requests_per_minute, requests_per_hour, requests_per_day, burst_limit, concurrent_limit) VALUES
  ('free', '*', 10, 100, 500, 3, 2),
  ('starter', '*', 30, 500, 5000, 5, 3),
  ('professional', '*', 60, 2000, 20000, 10, 5),
  ('enterprise', '*', 300, 10000, 100000, 50, 20)
ON CONFLICT (plan_tier, scope_pattern) DO NOTHING;

-- ── Seed default API versions ──
INSERT INTO public.api_versions (version, status, release_notes) VALUES
  ('v1', 'active', 'Initial API version with core HR endpoints'),
  ('v2', 'beta', 'Enhanced API with batch operations and webhooks')
ON CONFLICT (version) DO NOTHING;
