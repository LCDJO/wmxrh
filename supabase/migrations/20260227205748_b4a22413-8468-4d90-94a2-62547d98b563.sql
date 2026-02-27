
-- OAuth2 authorization grants table (codes, refresh tokens, device codes)
CREATE TABLE public.oauth2_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('authorization_code', 'refresh_token', 'device_code')),
  client_id TEXT NOT NULL,
  user_id UUID,
  code_hash TEXT,
  token_hash TEXT,
  redirect_uri TEXT,
  scope TEXT NOT NULL DEFAULT '',
  code_challenge TEXT,
  code_challenge_method TEXT CHECK (code_challenge_method IN ('S256', 'plain')),
  -- Device flow fields
  device_code_hash TEXT,
  user_code TEXT,
  verification_uri TEXT,
  device_status TEXT CHECK (device_status IN ('authorization_pending', 'approved', 'denied', 'expired')),
  -- Lifecycle
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_oauth2_grants_code ON public.oauth2_grants(code_hash) WHERE code_hash IS NOT NULL;
CREATE INDEX idx_oauth2_grants_token ON public.oauth2_grants(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX idx_oauth2_grants_device ON public.oauth2_grants(user_code) WHERE user_code IS NOT NULL;
CREATE INDEX idx_oauth2_grants_tenant ON public.oauth2_grants(tenant_id);
CREATE INDEX idx_oauth2_grants_expiry ON public.oauth2_grants(expires_at) WHERE revoked_at IS NULL AND is_used = false;

-- RLS
ALTER TABLE public.oauth2_grants ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage grants (edge functions use service_role)
CREATE POLICY "Service role manages oauth2 grants"
  ON public.oauth2_grants
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Revoke access from anon/authenticated by default
CREATE POLICY "Deny anon access to oauth2 grants"
  ON public.oauth2_grants
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "Deny authenticated access to oauth2 grants"
  ON public.oauth2_grants
  FOR ALL
  TO authenticated
  USING (false);
