
-- ═══════════════════════════════════════════════════════════════
-- RISK EXPOSURE: Employee-level + EPI + Hazard Pay integration
-- ═══════════════════════════════════════════════════════════════

-- 1. Add EPI fields to exposure_group_risks
ALTER TABLE public.exposure_group_risks
  ADD COLUMN IF NOT EXISTS requires_epi boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS epi_description text,
  ADD COLUMN IF NOT EXISTS epi_ca_number text;

-- 2. Employee-level risk exposure tracking
CREATE TABLE public.employee_risk_exposures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  risk_factor_id UUID NOT NULL REFERENCES public.occupational_risk_factors(id),
  exposure_group_id UUID REFERENCES public.exposure_groups(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  risk_level text NOT NULL DEFAULT 'baixo' CHECK (risk_level IN ('baixo','medio','alto','critico')),
  requires_epi boolean NOT NULL DEFAULT false,
  epi_description text,
  epi_ca_number text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  generates_hazard_pay boolean NOT NULL DEFAULT false,
  hazard_pay_type text CHECK (hazard_pay_type IN ('insalubridade','periculosidade')),
  hazard_pay_percentage numeric,
  notes text,
  created_by UUID,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.employee_risk_exposures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoped managers can view employee risk exposures"
  ON public.employee_risk_exposures FOR SELECT
  USING (can_manage_employees_scoped(auth.uid(), tenant_id, company_id, company_group_id));

CREATE POLICY "Managers can insert employee risk exposures"
  ON public.employee_risk_exposures FOR INSERT
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can update employee risk exposures"
  ON public.employee_risk_exposures FOR UPDATE
  USING (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can delete employee risk exposures"
  ON public.employee_risk_exposures FOR DELETE
  USING (can_manage_employees(auth.uid(), tenant_id));

-- 3. updated_at trigger
CREATE TRIGGER update_employee_risk_exposures_updated_at
  BEFORE UPDATE ON public.employee_risk_exposures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add hazard pay link fields to health_programs
ALTER TABLE public.health_programs
  ADD COLUMN IF NOT EXISTS generates_hazard_pay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hazard_pay_type text;
