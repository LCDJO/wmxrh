-- Add risk and blocking columns to user_sessions
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_by UUID,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Add user_id and tenant_id to user_session_events if missing
ALTER TABLE public.user_session_events
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Session security alerts table
CREATE TABLE public.session_security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  ip_address TEXT,
  location TEXT,
  risk_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_alerts_status ON public.session_security_alerts(status);
CREATE INDEX idx_security_alerts_created ON public.session_security_alerts(created_at DESC);

ALTER TABLE public.session_security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage security alerts"
  ON public.session_security_alerts FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_security_alerts;