
-- Training Audit Log for legal compliance
CREATE TABLE public.training_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  nr_codigo integer NOT NULL,
  action text NOT NULL, -- assigned, scheduled, completed, expired, renewed, waived, blocked, unblocked
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_training_audit_employee ON public.training_audit_logs(employee_id);
CREATE INDEX idx_training_audit_tenant_created ON public.training_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_training_audit_nr ON public.training_audit_logs(nr_codigo);

-- RLS
ALTER TABLE public.training_audit_logs ENABLE ROW LEVEL SECURITY;

-- RH/Admin can read all
CREATE POLICY "rh_admin_select_training_audit"
ON public.training_audit_logs FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'rh')
  )
);

-- RH/Admin can insert audit entries
CREATE POLICY "rh_admin_insert_training_audit"
ON public.training_audit_logs FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'rh')
  )
);

-- Employee can view own audit trail
CREATE POLICY "employee_select_own_training_audit"
ON public.training_audit_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = training_audit_logs.employee_id
      AND e.user_id = auth.uid()
  )
);

-- Auto-log training assignment changes via trigger
CREATE OR REPLACE FUNCTION public.fn_training_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'assigned';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := NEW.status; -- completed, expired, scheduled, etc.
    ELSE
      _action := 'updated';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'removed';
  END IF;

  INSERT INTO public.training_audit_logs (tenant_id, employee_id, nr_codigo, action, user_id, metadata)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.employee_id, OLD.employee_id),
    COALESCE(NEW.nr_codigo, OLD.nr_codigo),
    _action,
    auth.uid(),
    jsonb_build_object(
      'old_status', CASE WHEN TG_OP != 'INSERT' THEN OLD.status ELSE NULL END,
      'new_status', CASE WHEN TG_OP != 'DELETE' THEN NEW.status ELSE NULL END,
      'assignment_id', COALESCE(NEW.id, OLD.id)::text
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_training_audit
AFTER INSERT OR UPDATE OR DELETE ON public.nr_training_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_training_audit_log();
