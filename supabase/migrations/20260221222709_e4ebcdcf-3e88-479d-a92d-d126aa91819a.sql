
-- Fleet required agreements (termos obrigatórios)
CREATE TABLE public.fleet_required_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  agreement_template_id UUID NOT NULL REFERENCES public.agreement_templates(id),
  agreement_type TEXT NOT NULL CHECK (agreement_type IN ('vehicle_usage','fine_responsibility','gps_monitoring')),
  is_blocking BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, company_id, agreement_type)
);

ALTER TABLE public.fleet_required_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read fleet agreements"
  ON public.fleet_required_agreements FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can insert fleet agreements"
  ON public.fleet_required_agreements FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin')
  ));

CREATE POLICY "Tenant admins can update fleet agreements"
  ON public.fleet_required_agreements FOR UPDATE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin')
  ));

CREATE POLICY "Tenant admins can delete fleet agreements"
  ON public.fleet_required_agreements FOR DELETE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin')
  ));

CREATE TRIGGER update_fleet_required_agreements_updated_at
  BEFORE UPDATE ON public.fleet_required_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Employee fleet agreement status (tracks per-employee signing)
CREATE TABLE public.fleet_employee_agreement_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  required_agreement_id UUID NOT NULL REFERENCES public.fleet_required_agreements(id),
  agreement_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','signed','refused','expired')),
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, required_agreement_id)
);

CREATE INDEX idx_fleet_emp_agreement_employee ON public.fleet_employee_agreement_status(employee_id, status);
CREATE INDEX idx_fleet_emp_agreement_tenant ON public.fleet_employee_agreement_status(tenant_id);

ALTER TABLE public.fleet_employee_agreement_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read employee agreement status"
  ON public.fleet_employee_agreement_status FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Service or auth inserts employee agreement status"
  ON public.fleet_employee_agreement_status FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

CREATE POLICY "Tenant admins can update employee agreement status"
  ON public.fleet_employee_agreement_status FOR UPDATE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin','gestor')
  ));

CREATE TRIGGER update_fleet_emp_agreement_status_updated_at
  BEFORE UPDATE ON public.fleet_employee_agreement_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
