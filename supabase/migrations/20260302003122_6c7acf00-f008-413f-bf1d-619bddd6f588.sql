
-- ══════════════════════════════════════════════
-- TIME TRACKING ENGINE — Full Schema
-- ══════════════════════════════════════════════

-- 1. Clock Events (ponto eletrônico)
CREATE TABLE public.clock_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'biometric', 'geofence', 'app')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  device_id TEXT,
  notes TEXT,
  approved_by UUID,
  is_adjusted BOOLEAN NOT NULL DEFAULT false,
  adjusted_from TIMESTAMPTZ,
  adjustment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clock_events_tenant_employee ON public.clock_events(tenant_id, employee_id);
CREATE INDEX idx_clock_events_timestamp ON public.clock_events(tenant_id, timestamp DESC);

ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_clock_events" ON public.clock_events FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- 2. Daily Summaries (resumo diário calculado)
CREATE TABLE public.time_daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused', 'holiday', 'vacation')),
  first_clock_in TIMESTAMPTZ,
  last_clock_out TIMESTAMPTZ,
  total_worked_minutes INT NOT NULL DEFAULT 0,
  break_minutes INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  overtime_type TEXT CHECK (overtime_type IN ('regular_50', 'regular_100', 'nocturnal', 'holiday')),
  is_nocturnal BOOLEAN NOT NULL DEFAULT false,
  nocturnal_minutes INT NOT NULL DEFAULT 0,
  deficit_minutes INT NOT NULL DEFAULT 0,
  expected_minutes INT NOT NULL DEFAULT 480,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, employee_id, date)
);

CREATE INDEX idx_daily_summaries_lookup ON public.time_daily_summaries(tenant_id, employee_id, date DESC);

ALTER TABLE public.time_daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_time_daily_summaries" ON public.time_daily_summaries FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- 3. Time Bank (banco de horas)
CREATE TABLE public.time_bank_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit', 'expiry', 'adjustment')),
  minutes INT NOT NULL,
  reference_date DATE NOT NULL,
  source_summary_id UUID REFERENCES public.time_daily_summaries(id),
  reason TEXT,
  expires_at DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_bank_employee ON public.time_bank_entries(tenant_id, employee_id, reference_date DESC);

ALTER TABLE public.time_bank_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_time_bank_entries" ON public.time_bank_entries FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- 4. Time Tracking Rules (regras configuráveis por tenant)
CREATE TABLE public.time_tracking_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  rule_key TEXT NOT NULL,
  rule_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, rule_key)
);

ALTER TABLE public.time_tracking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_time_tracking_rules" ON public.time_tracking_rules FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- 5. Time Tracking Alerts (alertas automáticos)
CREATE TABLE public.time_tracking_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'missing_clock_out', 'late_arrival', 'overtime_limit',
    'consecutive_overtime', 'missing_break', 'bank_expiring',
    'nocturnal_exceeded', 'irregular_pattern'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  reference_date DATE NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_alerts_unresolved ON public.time_tracking_alerts(tenant_id, is_resolved, created_at DESC);

ALTER TABLE public.time_tracking_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_time_tracking_alerts" ON public.time_tracking_alerts FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_time_daily_summaries_updated_at
  BEFORE UPDATE ON public.time_daily_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_tracking_rules_updated_at
  BEFORE UPDATE ON public.time_tracking_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
