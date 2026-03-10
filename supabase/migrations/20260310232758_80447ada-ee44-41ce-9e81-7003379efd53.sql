
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  session_token TEXT,

  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at TIMESTAMPTZ,

  ip_address TEXT,
  ipv6 TEXT,

  country TEXT,
  state TEXT,
  city TEXT,

  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  browser TEXT,
  browser_version TEXT,

  os TEXT,
  device_type TEXT,

  user_agent TEXT,

  login_method TEXT DEFAULT 'password',
  sso_provider TEXT,

  is_mobile BOOLEAN DEFAULT false,
  is_vpn BOOLEAN DEFAULT false,
  is_proxy BOOLEAN DEFAULT false,

  session_duration INTEGER,

  status TEXT NOT NULL DEFAULT 'online',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "Users can read own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Index for quick lookups
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_tenant_id ON public.user_sessions(tenant_id);
CREATE INDEX idx_user_sessions_status ON public.user_sessions(status);
