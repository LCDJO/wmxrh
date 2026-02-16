
-- ═══════════════════════════════════════════════════════════════
-- SALARY COMPOSITION ENGINE
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE public.rubric_base_calculo AS ENUM ('salario_base', 'percentual', 'manual');

-- 1. SALARY STRUCTURE (Aggregate Root)
CREATE TABLE public.salary_structures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compensation viewers can view salary structures" ON public.salary_structures
  FOR SELECT USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));
CREATE POLICY "Compensation managers can insert salary structures" ON public.salary_structures
  FOR INSERT WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));
CREATE POLICY "Compensation managers can update salary structures" ON public.salary_structures
  FOR UPDATE USING (can_manage_compensation(auth.uid(), tenant_id));
CREATE POLICY "Compensation managers can delete salary structures" ON public.salary_structures
  FOR DELETE USING (can_manage_compensation(auth.uid(), tenant_id));

CREATE TRIGGER update_salary_structures_updated_at
  BEFORE UPDATE ON public.salary_structures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_salary_structures_employee ON public.salary_structures(employee_id);
CREATE INDEX idx_salary_structures_tenant ON public.salary_structures(tenant_id);

-- 2. SALARY RUBRICS (linked to structure)
CREATE TABLE public.salary_rubrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  salary_structure_id UUID NOT NULL REFERENCES public.salary_structures(id) ON DELETE CASCADE,
  rubric_code TEXT NOT NULL,
  name TEXT NOT NULL,
  item_type public.payroll_item_type NOT NULL DEFAULT 'provento',
  nature public.payroll_item_nature NOT NULL DEFAULT 'fixed',
  base_calculo public.rubric_base_calculo NOT NULL DEFAULT 'manual',
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC,
  integra_fgts BOOLEAN NOT NULL DEFAULT false,
  integra_inss BOOLEAN NOT NULL DEFAULT false,
  integra_irrf BOOLEAN NOT NULL DEFAULT false,
  esocial_code TEXT,
  catalog_item_id UUID REFERENCES public.payroll_item_catalog(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.salary_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view salary rubrics" ON public.salary_rubrics
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.salary_structures ss
    WHERE ss.id = salary_rubrics.salary_structure_id
    AND can_view_compensation_scoped(auth.uid(), ss.tenant_id, ss.company_id, ss.company_group_id)
  ));
CREATE POLICY "Managers can insert salary rubrics" ON public.salary_rubrics
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.salary_structures ss
    WHERE ss.id = salary_rubrics.salary_structure_id
    AND can_manage_compensation(auth.uid(), ss.tenant_id)
  ));
CREATE POLICY "Managers can update salary rubrics" ON public.salary_rubrics
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.salary_structures ss
    WHERE ss.id = salary_rubrics.salary_structure_id
    AND can_manage_compensation(auth.uid(), ss.tenant_id)
  ));
CREATE POLICY "Managers can delete salary rubrics" ON public.salary_rubrics
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.salary_structures ss
    WHERE ss.id = salary_rubrics.salary_structure_id
    AND can_manage_compensation(auth.uid(), ss.tenant_id)
  ));

CREATE TRIGGER update_salary_rubrics_updated_at
  BEFORE UPDATE ON public.salary_rubrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_salary_rubrics_structure ON public.salary_rubrics(salary_structure_id);
CREATE INDEX idx_salary_rubrics_tenant ON public.salary_rubrics(tenant_id);

-- 3. Auto-close previous active structure when new one is created
CREATE OR REPLACE FUNCTION public.auto_close_previous_salary_structure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.salary_structures
  SET is_active = false, end_date = NEW.start_date - INTERVAL '1 day'
  WHERE employee_id = NEW.employee_id
    AND is_active = true
    AND id != NEW.id
    AND deleted_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_close_salary_structure
  AFTER INSERT ON public.salary_structures
  FOR EACH ROW EXECUTE FUNCTION public.auto_close_previous_salary_structure();
