
-- Internal alerts for Integration Health & Monitoring Engine
CREATE TABLE public.integration_health_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  health_check_id UUID REFERENCES public.integration_health_checks(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'TENANT_SERVER_DOWN',
    'NO_EVENTS_DETECTED',
    'DEVICE_SYNC_ERROR',
    'ALERT_ENGINE_FAILURE'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  message TEXT NOT NULL,
  details JSONB,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read health alerts"
ON public.integration_health_alerts
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

CREATE POLICY "Platform admins can update health alerts"
ON public.integration_health_alerts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
    AND pu.role IN ('platform_super_admin', 'platform_operations')
    AND pu.status = 'active'
  )
);

CREATE POLICY "Service role can insert health alerts"
ON public.integration_health_alerts
FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_health_alerts_tenant ON public.integration_health_alerts(tenant_id, created_at DESC);
CREATE INDEX idx_health_alerts_unresolved ON public.integration_health_alerts(is_resolved, severity) WHERE is_resolved = false;
