
-- NR Training Lifecycle Engine — Database Schema

-- 1. Training Assignments
CREATE TABLE public.nr_training_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  nr_number INTEGER NOT NULL,
  training_name TEXT NOT NULL,
  cbo_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger TEXT NOT NULL DEFAULT 'manual',
  required_hours NUMERIC NOT NULL DEFAULT 8,
  due_date DATE,
  blocking_level TEXT NOT NULL DEFAULT 'none',
  is_renewal BOOLEAN NOT NULL DEFAULT false,
  previous_assignment_id UUID REFERENCES public.nr_training_assignments(id),
  renewal_number INTEGER NOT NULL DEFAULT 0,
  legal_basis TEXT,
  validity_months INTEGER,
  waiver_reason TEXT,
  waiver_approved_by UUID,
  agreement_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Training Completions (immutable)
CREATE TABLE public.nr_training_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  assignment_id UUID NOT NULL REFERENCES public.nr_training_assignments(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  completed_at TIMESTAMPTZ NOT NULL,
  expires_at DATE,
  hours_completed NUMERIC NOT NULL,
  instructor_name TEXT,
  provider_name TEXT,
  certificate_number TEXT,
  certificate_url TEXT,
  score NUMERIC,
  passed BOOLEAN NOT NULL DEFAULT true,
  location TEXT,
  methodology TEXT,
  observations TEXT,
  registered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Lifecycle Audit Log (immutable)
CREATE TABLE public.nr_training_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  assignment_id UUID NOT NULL REFERENCES public.nr_training_assignments(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  performed_by UUID,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_nr_assignments_tenant ON public.nr_training_assignments(tenant_id);
CREATE INDEX idx_nr_assignments_employee ON public.nr_training_assignments(employee_id);
CREATE INDEX idx_nr_assignments_company ON public.nr_training_assignments(company_id);
CREATE INDEX idx_nr_assignments_status ON public.nr_training_assignments(status);
CREATE INDEX idx_nr_assignments_nr ON public.nr_training_assignments(nr_number);
CREATE INDEX idx_nr_assignments_due ON public.nr_training_assignments(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_nr_completions_assignment ON public.nr_training_completions(assignment_id);
CREATE INDEX idx_nr_completions_employee ON public.nr_training_completions(employee_id);
CREATE INDEX idx_nr_completions_expires ON public.nr_training_completions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_nr_audit_assignment ON public.nr_training_audit_log(assignment_id);

-- RLS
ALTER TABLE public.nr_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nr_training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nr_training_audit_log ENABLE ROW LEVEL SECURITY;

-- Assignments
CREATE POLICY "Tenant members can view training assignments"
  ON public.nr_training_assignments FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Managers can insert training assignments"
  ON public.nr_training_assignments FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('superadmin','owner','admin','tenant_admin','group_admin','company_admin','rh')
  ));

CREATE POLICY "Managers can update training assignments"
  ON public.nr_training_assignments FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('superadmin','owner','admin','tenant_admin','group_admin','company_admin','rh')
  ));

-- Completions (immutable — no update/delete)
CREATE POLICY "Tenant members can view training completions"
  ON public.nr_training_completions FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Managers can insert training completions"
  ON public.nr_training_completions FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('superadmin','owner','admin','tenant_admin','group_admin','company_admin','rh')
  ));

-- Audit log (immutable — no update/delete)
CREATE POLICY "Tenant members can view training audit log"
  ON public.nr_training_audit_log FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "System can insert training audit log"
  ON public.nr_training_audit_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_nr_training_assignments_updated_at
  BEFORE UPDATE ON public.nr_training_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
