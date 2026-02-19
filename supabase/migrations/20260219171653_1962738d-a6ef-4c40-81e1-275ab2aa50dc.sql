
-- ══════════════════════════════════════
-- Developer Portal: OAuth Clients + Sandbox Sessions
-- ══════════════════════════════════════

-- 3) OAuth Clients
CREATE TABLE public.developer_oauth_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  client_id_hash TEXT NOT NULL,
  client_secret_hash TEXT NOT NULL,
  grant_types TEXT[] NOT NULL DEFAULT '{client_credentials}',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  token_lifetime_seconds INTEGER NOT NULL DEFAULT 3600,
  refresh_token_lifetime_seconds INTEGER NOT NULL DEFAULT 2592000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked')),
  last_used_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_oauth_clients ENABLE ROW LEVEL SECURITY;

-- Platform users full access
CREATE POLICY "Platform manage oauth clients"
  ON public.developer_oauth_clients FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Developers can view/manage their own app's clients
CREATE POLICY "Developers view own oauth clients"
  ON public.developer_oauth_clients FOR SELECT
  TO authenticated
  USING (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

CREATE POLICY "Developers create oauth clients"
  ON public.developer_oauth_clients FOR INSERT
  TO authenticated
  WITH CHECK (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

CREATE POLICY "Developers update own oauth clients"
  ON public.developer_oauth_clients FOR UPDATE
  TO authenticated
  USING (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ))
  WITH CHECK (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

CREATE TRIGGER update_developer_oauth_clients_updated_at
  BEFORE UPDATE ON public.developer_oauth_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_oauth_clients_app ON public.developer_oauth_clients(app_id);
CREATE INDEX idx_oauth_clients_status ON public.developer_oauth_clients(status);

-- 4) Sandbox Sessions
CREATE TABLE public.developer_sandbox_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  developer_id UUID NOT NULL REFERENCES public.developer_accounts(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  environment_id TEXT NOT NULL,
  sandbox_api_key_hash TEXT NOT NULL,
  sandbox_tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'expired', 'terminated')),
  seed_data_template TEXT,
  api_base_url TEXT NOT NULL,
  billing_blocked BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_sandbox_sessions ENABLE ROW LEVEL SECURITY;

-- Platform users full access
CREATE POLICY "Platform manage sandbox sessions"
  ON public.developer_sandbox_sessions FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Developers manage own sessions
CREATE POLICY "Developers view own sandboxes"
  ON public.developer_sandbox_sessions FOR SELECT
  TO authenticated
  USING (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Developers create sandboxes"
  ON public.developer_sandbox_sessions FOR INSERT
  TO authenticated
  WITH CHECK (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Developers update own sandboxes"
  ON public.developer_sandbox_sessions FOR UPDATE
  TO authenticated
  USING (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()))
  WITH CHECK (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE INDEX idx_sandbox_sessions_developer ON public.developer_sandbox_sessions(developer_id);
CREATE INDEX idx_sandbox_sessions_status ON public.developer_sandbox_sessions(status);
CREATE INDEX idx_sandbox_sessions_expires ON public.developer_sandbox_sessions(expires_at);
