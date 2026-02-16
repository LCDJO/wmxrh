
-- ═══════════════════════════════════════════════════════════════
-- BENEFITS ENGINE: VA/VR/Cesta/Flex + Natureza Indenizatória
-- ═══════════════════════════════════════════════════════════════

-- 1. Extend benefit_type enum with 'cesta' and 'flex'
ALTER TYPE public.benefit_type ADD VALUE IF NOT EXISTS 'cesta';
ALTER TYPE public.benefit_type ADD VALUE IF NOT EXISTS 'flex';

-- 2. Add indemnity nature + salary integration flags to benefit_plans
ALTER TABLE public.benefit_plans
  ADD COLUMN IF NOT EXISTS is_indemnity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS integrates_salary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_basis text;

-- 3. Add employee-level override fields to employee_benefits
ALTER TABLE public.employee_benefits
  ADD COLUMN IF NOT EXISTS monthly_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employee_discount_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_pays_pct numeric DEFAULT 100;

-- 4. Trigger: validate discount cannot exceed 100%
CREATE OR REPLACE FUNCTION public.validate_benefit_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.employee_discount_pct < 0 OR NEW.employee_discount_pct > 100 THEN
    RAISE EXCEPTION 'Employee discount must be between 0%% and 100%%';
  END IF;
  IF NEW.employer_pays_pct < 0 OR NEW.employer_pays_pct > 100 THEN
    RAISE EXCEPTION 'Employer percentage must be between 0%% and 100%%';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_benefit_discount
  BEFORE INSERT OR UPDATE ON public.employee_benefits
  FOR EACH ROW EXECUTE FUNCTION public.validate_benefit_discount();
