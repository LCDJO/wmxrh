
-- Create impersonation_sessions table
CREATE TABLE public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'ended', 'forced')),
  ended_at TIMESTAMPTZ,
  operation_count INTEGER NOT NULL DEFAULT 0,
  simulated_role TEXT NOT NULL DEFAULT 'tenant_admin',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only platform users (via security definer) can access
CREATE OR REPLACE FUNCTION public.is_platform_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin')
  );
$$;

-- Platform users can view all impersonation sessions
CREATE POLICY "Platform users can view impersonation sessions"
ON public.impersonation_sessions
FOR SELECT
TO authenticated
USING (public.is_platform_user(auth.uid()));

-- Platform users can insert impersonation sessions
CREATE POLICY "Platform users can insert impersonation sessions"
ON public.impersonation_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_user(auth.uid()) AND platform_user_id = auth.uid());

-- Platform users can update their own sessions (end/expire)
CREATE POLICY "Platform users can update own sessions"
ON public.impersonation_sessions
FOR UPDATE
TO authenticated
USING (public.is_platform_user(auth.uid()) AND platform_user_id = auth.uid());

-- Index for quick lookups
CREATE INDEX idx_impersonation_sessions_platform_user ON public.impersonation_sessions(platform_user_id);
CREATE INDEX idx_impersonation_sessions_tenant ON public.impersonation_sessions(tenant_id);
CREATE INDEX idx_impersonation_sessions_status ON public.impersonation_sessions(status);
