
-- Fleet driving rules per company
CREATE TABLE public.fleet_driving_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  speed_limit_kmh DOUBLE PRECISION NOT NULL DEFAULT 80,
  allowed_hours_start TIME NOT NULL DEFAULT '06:00',
  allowed_hours_end TIME NOT NULL DEFAULT '22:00',
  geofence_polygon JSONB,
  planned_route JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, company_id)
);

ALTER TABLE public.fleet_driving_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read driving rules"
  ON public.fleet_driving_rules FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can insert driving rules"
  ON public.fleet_driving_rules FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin')
  ));

CREATE POLICY "Tenant admins can update driving rules"
  ON public.fleet_driving_rules FOR UPDATE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin')
  ));

CREATE TRIGGER update_fleet_driving_rules_updated_at
  BEFORE UPDATE ON public.fleet_driving_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Behavior events (append-only, immutable)
CREATE TABLE public.fleet_behavior_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  device_id TEXT NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('overspeed','geofence_violation','route_deviation','after_hours_use')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  details JSONB NOT NULL DEFAULT '{}',
  source_event_id UUID REFERENCES public.raw_tracking_events(id),
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_behavior_tenant_ts ON public.fleet_behavior_events(tenant_id, event_timestamp DESC);
CREATE INDEX idx_fleet_behavior_employee ON public.fleet_behavior_events(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_fleet_behavior_type ON public.fleet_behavior_events(event_type, severity);

ALTER TABLE public.fleet_behavior_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read behavior events"
  ON public.fleet_behavior_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

-- Service role inserts only
CREATE POLICY "Authenticated or service role inserts behavior events"
  ON public.fleet_behavior_events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- Immutability
CREATE POLICY "No updates on behavior events" ON public.fleet_behavior_events FOR UPDATE USING (false);
CREATE POLICY "No deletes on behavior events" ON public.fleet_behavior_events FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION public.prevent_behavior_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'fleet_behavior_events is immutable.';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_behavior_immutability
  BEFORE UPDATE OR DELETE ON public.fleet_behavior_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_behavior_event_mutation();
