
-- SESSION RISK ANALYSIS TABLE
CREATE TABLE public.session_risk_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_risk_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_risk_analysis" ON public.session_risk_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_insert_risk_analysis" ON public.session_risk_analysis FOR INSERT TO authenticated WITH CHECK (true);

-- SECURITY ALERTS TABLE
CREATE TABLE public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  location TEXT,
  ip_address TEXT,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT,
  auto_action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_sec_alerts" ON public.security_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_insert_sec_alerts" ON public.security_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins_update_sec_alerts" ON public.security_alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_alerts;

-- USER DEVICES TABLE
CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  device_type TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  trusted BOOLEAN NOT NULL DEFAULT false,
  trusted_at TIMESTAMPTZ,
  trusted_by UUID,
  login_count INTEGER NOT NULL DEFAULT 1,
  ip_addresses TEXT[] DEFAULT '{}',
  countries TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_user_devices" ON public.user_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_insert_user_devices" ON public.user_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "system_update_user_devices" ON public.user_devices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- INDEXES
CREATE INDEX idx_sra_user_id ON public.session_risk_analysis(user_id);
CREATE INDEX idx_sra_risk_level ON public.session_risk_analysis(risk_level);
CREATE INDEX idx_sra_session_id ON public.session_risk_analysis(session_id);
CREATE INDEX idx_sec_alerts_v2_status ON public.security_alerts(status);
CREATE INDEX idx_sec_alerts_v2_user ON public.security_alerts(user_id);
CREATE INDEX idx_sec_alerts_v2_tenant ON public.security_alerts(tenant_id);
CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX idx_user_devices_fp ON public.user_devices(device_fingerprint);

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_risk_analysis;
