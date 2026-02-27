
-- MFA readiness: add mfa columns to federation_sessions
ALTER TABLE public.federation_sessions
  ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_method TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS step_up_authenticated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS step_up_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refresh_token_family_id UUID DEFAULT NULL;

-- MFA enrollment table
CREATE TABLE IF NOT EXISTS public.mfa_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  method TEXT NOT NULL CHECK (method IN ('totp', 'webauthn', 'sms', 'email')),
  status TEXT NOT NULL DEFAULT 'not_enrolled' CHECK (status IN ('not_enrolled', 'enrolled', 'verified', 'locked')),
  secret_encrypted TEXT DEFAULT NULL,
  recovery_codes_hash TEXT[] DEFAULT '{}',
  recovery_codes_remaining INTEGER NOT NULL DEFAULT 10,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ DEFAULT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NULL,
  last_verified_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, method)
);

ALTER TABLE public.mfa_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MFA enrollments"
  ON public.mfa_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own MFA enrollments"
  ON public.mfa_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MFA enrollments"
  ON public.mfa_enrollments FOR UPDATE
  USING (auth.uid() = user_id);

-- Refresh token family tracking for reuse detection
CREATE TABLE IF NOT EXISTS public.refresh_token_families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  generation INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ DEFAULT NULL,
  reuse_detected_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.refresh_token_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for refresh token families"
  ON public.refresh_token_families FOR ALL
  USING (false);

CREATE INDEX IF NOT EXISTS idx_refresh_token_families_family ON public.refresh_token_families(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_families_hash ON public.refresh_token_families(token_hash);
CREATE INDEX IF NOT EXISTS idx_mfa_enrollments_user ON public.mfa_enrollments(user_id, tenant_id);
