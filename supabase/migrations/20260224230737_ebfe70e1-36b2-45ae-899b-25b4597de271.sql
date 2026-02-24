
CREATE TABLE public.integration_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_connection JSONB NOT NULL DEFAULT '{"status":"unknown"}',
  api_authentication JSONB NOT NULL DEFAULT '{"status":"unknown"}',
  device_sync JSONB NOT NULL DEFAULT '{"status":"unknown"}',
  event_flow JSONB NOT NULL DEFAULT '{"status":"unknown"}',
  queue_health JSONB NOT NULL DEFAULT '{"status":"unknown"}',
  alert_generation JSONB NOT NULL DEFAULT '{"status":"unknown"}',
  devices_synced INT NOT NULL DEFAULT 0,
  events_last_24h INT NOT NULL DEFAULT 0,
  alerts_last_24h INT NOT NULL DEFAULT 0,
  last_event_received TIMESTAMPTZ,
  queue_lag INT NOT NULL DEFAULT 0,
  server_response_time_ms INT,
  health_score INT NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy','degraded','critical','unknown')),
  check_duration_ms INT,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read all health checks"
ON public.integration_health_checks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
    AND pu.role IN ('platform_super_admin', 'platform_operations')
    AND pu.status = 'active'
  )
);

CREATE POLICY "Service role can insert health checks"
ON public.integration_health_checks
FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_health_checks_tenant_checked 
ON public.integration_health_checks(tenant_id, checked_at DESC);

CREATE INDEX idx_health_checks_status 
ON public.integration_health_checks(health_status, checked_at DESC);
