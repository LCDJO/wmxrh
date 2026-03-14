-- 1. Add logout_reason to user_sessions
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS logout_reason text;

-- 2. Create session_history table
CREATE TABLE public.session_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  login_at timestamptz NOT NULL,
  logout_at timestamptz NOT NULL,
  duration_seconds integer,
  ip_address text,
  country text,
  state text,
  city text,
  latitude double precision,
  longitude double precision,
  browser text,
  browser_version text,
  os text,
  device_type text,
  device_fingerprint text,
  user_agent text,
  login_method text,
  is_mobile boolean DEFAULT false,
  is_vpn boolean DEFAULT false,
  is_proxy boolean DEFAULT false,
  asn_name text,
  risk_score integer DEFAULT 0,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  logout_reason text NOT NULL DEFAULT 'user_logout',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_history ENABLE ROW LEVEL SECURITY;

-- RLS: users read own history
CREATE POLICY "Users can read own session history"
ON public.session_history FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- RLS: platform admins read all
CREATE POLICY "Platform admins can read all session history"
ON public.session_history FOR SELECT TO authenticated
USING (
  has_platform_role(auth.uid(), 'platform_super_admin'::platform_role)
  OR has_platform_role(auth.uid(), 'platform_support'::platform_role)
);

-- RLS: system inserts (via service or function)
CREATE POLICY "System can insert session history"
ON public.session_history FOR INSERT TO authenticated
WITH CHECK (true);

-- 3. Function to archive a session to history
CREATE OR REPLACE FUNCTION public.archive_session(
  p_session_id uuid,
  p_logout_reason text DEFAULT 'user_logout'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session FROM user_sessions WHERE id = p_session_id AND status != 'offline';
  IF NOT FOUND THEN RETURN; END IF;

  -- Insert into history
  INSERT INTO session_history (
    session_id, tenant_id, user_id, login_at, logout_at, duration_seconds,
    ip_address, country, state, city, latitude, longitude,
    browser, browser_version, os, device_type, device_fingerprint,
    user_agent, login_method, is_mobile, is_vpn, is_proxy, asn_name,
    risk_score, risk_factors, logout_reason
  ) VALUES (
    v_session.id, v_session.tenant_id, v_session.user_id, v_session.login_at, now(),
    EXTRACT(EPOCH FROM (now() - v_session.login_at))::integer,
    v_session.ip_address, v_session.country, v_session.state, v_session.city,
    v_session.latitude, v_session.longitude,
    v_session.browser, v_session.browser_version, v_session.os, v_session.device_type,
    v_session.device_fingerprint, v_session.user_agent, v_session.login_method,
    v_session.is_mobile, v_session.is_vpn, v_session.is_proxy, v_session.asn_name,
    v_session.risk_score, v_session.risk_factors, p_logout_reason
  );

  -- Mark session as offline
  UPDATE user_sessions SET
    status = 'offline',
    logout_at = now(),
    logout_reason = p_logout_reason,
    session_duration = EXTRACT(EPOCH FROM (now() - v_session.login_at))::integer
  WHERE id = p_session_id;
END;
$$;

-- 4. Function to enforce single session per user+tenant
CREATE OR REPLACE FUNCTION public.enforce_single_session(
  p_user_id uuid,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  FOR v_session IN
    SELECT id FROM user_sessions
    WHERE user_id = p_user_id
      AND status IN ('online', 'idle')
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  LOOP
    PERFORM archive_session(v_session.id, 'new_login');
  END LOOP;
END;
$$;

-- 5. Function for admin remote logout
CREATE OR REPLACE FUNCTION public.admin_logout_session(
  p_session_id uuid,
  p_performed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is platform admin
  IF NOT (
    has_platform_role(p_performed_by, 'platform_super_admin'::platform_role)
    OR has_platform_role(p_performed_by, 'platform_support'::platform_role)
  ) THEN
    RETURN false;
  END IF;

  PERFORM archive_session(p_session_id, 'admin_logout');
  RETURN true;
END;
$$;

-- 6. Update timeout cleanup to use archive
CREATE OR REPLACE FUNCTION public.cleanup_idle_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  FOR v_session IN
    SELECT id FROM user_sessions
    WHERE status IN ('online', 'idle')
      AND last_activity < now() - interval '30 minutes'
  LOOP
    PERFORM archive_session(v_session.id, 'session_timeout');
  END LOOP;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_history;