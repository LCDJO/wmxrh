
-- ═══════════════════════════════════════════════════════════════
-- COMPLIANCE RULES ENGINE: Automated validations
-- ═══════════════════════════════════════════════════════════════

-- 1. Prevent zero base salary for active CLT employees
CREATE OR REPLACE FUNCTION public.validate_employee_salary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'active' AND (NEW.base_salary IS NULL OR NEW.base_salary <= 0) AND NEW.hire_date IS NOT NULL THEN
    RAISE EXCEPTION 'Active CLT employees must have a base salary greater than zero.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_employee_salary
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.validate_employee_salary();

-- 2. Hazard pay additional requires active risk exposure
CREATE OR REPLACE FUNCTION public.validate_hazard_additional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.additional_type IN ('hazard_pay') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_risk_exposures
      WHERE employee_id = NEW.employee_id
        AND generates_hazard_pay = true
        AND is_active = true
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Hazard pay additional requires an active risk exposure with generates_hazard_pay enabled.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_hazard_additional
  BEFORE INSERT OR UPDATE ON public.salary_additionals
  FOR EACH ROW EXECUTE FUNCTION public.validate_hazard_additional();

-- 3. Compliance violations tracking table
CREATE TABLE public.compliance_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  violation_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  description text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by UUID,
  is_resolved boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoped managers can view compliance violations"
  ON public.compliance_violations FOR SELECT
  USING (can_manage_employees_scoped(auth.uid(), tenant_id, company_id, NULL));

CREATE POLICY "System can insert compliance violations"
  ON public.compliance_violations FOR INSERT
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can update compliance violations"
  ON public.compliance_violations FOR UPDATE
  USING (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Block compliance violation deletes"
  ON public.compliance_violations FOR DELETE
  USING (false);

-- 4. Function: scan employee compliance (risk exposure without valid exam)
CREATE OR REPLACE FUNCTION public.scan_employee_compliance(_tenant_id UUID)
RETURNS TABLE(
  employee_id UUID,
  employee_name text,
  company_id UUID,
  violation_type text,
  severity text,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Rule 1: Employees with active risk exposure but no valid periodic exam
  RETURN QUERY
  SELECT DISTINCT
    e.id,
    e.name,
    e.company_id,
    'missing_periodic_exam'::text,
    'critical'::text,
    ('Colaborador ' || e.name || ' possui exposição a risco ativa mas não possui exame periódico válido.')::text
  FROM public.employees e
  JOIN public.employee_risk_exposures ere ON ere.employee_id = e.id
    AND ere.is_active = true AND ere.deleted_at IS NULL
  WHERE e.tenant_id = _tenant_id
    AND e.status = 'active'
    AND e.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_health_exams ex
      WHERE ex.employee_id = e.id
        AND ex.exam_type = 'periodico'
        AND ex.is_valid = true
        AND ex.deleted_at IS NULL
        AND (ex.next_exam_date IS NULL OR ex.next_exam_date >= CURRENT_DATE)
    );

  -- Rule 2: Active employees with zero salary
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.company_id,
    'zero_base_salary'::text,
    'warning'::text,
    ('Colaborador ativo ' || e.name || ' possui salário base zero ou nulo.')::text
  FROM public.employees e
  WHERE e.tenant_id = _tenant_id
    AND e.status = 'active'
    AND e.deleted_at IS NULL
    AND e.hire_date IS NOT NULL
    AND (e.base_salary IS NULL OR e.base_salary <= 0);

  -- Rule 3: Hazard pay without risk exposure
  RETURN QUERY
  SELECT DISTINCT
    e.id,
    e.name,
    e.company_id,
    'hazard_pay_no_exposure'::text,
    'critical'::text,
    ('Colaborador ' || e.name || ' recebe adicional de periculosidade/insalubridade sem exposição a risco registrada.')::text
  FROM public.employees e
  JOIN public.salary_additionals sa ON sa.employee_id = e.id
    AND sa.additional_type = 'hazard_pay'
    AND sa.deleted_at IS NULL
    AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
  WHERE e.tenant_id = _tenant_id
    AND e.status = 'active'
    AND e.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_risk_exposures ere
      WHERE ere.employee_id = e.id
        AND ere.generates_hazard_pay = true
        AND ere.is_active = true
        AND ere.deleted_at IS NULL
    );
END;
$$;
