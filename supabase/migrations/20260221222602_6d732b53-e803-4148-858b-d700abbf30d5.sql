
-- Fleet warnings (advertências automáticas)
CREATE TABLE public.fleet_warnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  incident_id UUID NOT NULL REFERENCES public.fleet_compliance_incidents(id),
  warning_type TEXT NOT NULL DEFAULT 'verbal' CHECK (warning_type IN ('verbal','written','suspension','termination')),
  description TEXT NOT NULL,
  document_url TEXT,
  signature_request_id TEXT,
  signature_status TEXT NOT NULL DEFAULT 'pending' CHECK (signature_status IN ('pending','sent','signed','refused','expired')),
  signed_at TIMESTAMPTZ,
  issued_by UUID,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_warnings_employee ON public.fleet_warnings(employee_id);
CREATE INDEX idx_fleet_warnings_tenant ON public.fleet_warnings(tenant_id, created_at DESC);
CREATE INDEX idx_fleet_warnings_incident ON public.fleet_warnings(incident_id);

ALTER TABLE public.fleet_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read warnings"
  ON public.fleet_warnings FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Service or auth inserts warnings"
  ON public.fleet_warnings FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

CREATE POLICY "Tenant admins can update warnings"
  ON public.fleet_warnings FOR UPDATE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin','gestor')
  ));

CREATE TRIGGER update_fleet_warnings_updated_at
  BEFORE UPDATE ON public.fleet_warnings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Disciplinary history (append-only audit trail)
CREATE TABLE public.fleet_disciplinary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  warning_id UUID REFERENCES public.fleet_warnings(id),
  incident_id UUID REFERENCES public.fleet_compliance_incidents(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('warning_issued','warning_signed','warning_refused','escalation','note_added')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_disciplinary_employee ON public.fleet_disciplinary_history(employee_id, created_at DESC);

ALTER TABLE public.fleet_disciplinary_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read disciplinary history"
  ON public.fleet_disciplinary_history FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Service or auth inserts disciplinary history"
  ON public.fleet_disciplinary_history FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- Immutability
CREATE POLICY "No updates on disciplinary history" ON public.fleet_disciplinary_history FOR UPDATE USING (false);
CREATE POLICY "No deletes on disciplinary history" ON public.fleet_disciplinary_history FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION public.prevent_disciplinary_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'fleet_disciplinary_history is immutable.';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_disciplinary_immutability
  BEFORE UPDATE OR DELETE ON public.fleet_disciplinary_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_disciplinary_history_mutation();
