
-- Fleet compliance incidents
CREATE TABLE public.fleet_compliance_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID REFERENCES public.employees(id),
  device_id TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  evidence JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','warning_issued','closed')),
  behavior_event_id UUID REFERENCES public.fleet_behavior_events(id),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_incidents_tenant_status ON public.fleet_compliance_incidents(tenant_id, status);
CREATE INDEX idx_fleet_incidents_employee ON public.fleet_compliance_incidents(employee_id) WHERE employee_id IS NOT NULL;

ALTER TABLE public.fleet_compliance_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read incidents"
  ON public.fleet_compliance_incidents FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Service or auth inserts incidents"
  ON public.fleet_compliance_incidents FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

CREATE POLICY "Tenant admins can update incidents"
  ON public.fleet_compliance_incidents FOR UPDATE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin','gestor')
  ));

CREATE TRIGGER update_fleet_incidents_updated_at
  BEFORE UPDATE ON public.fleet_compliance_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
