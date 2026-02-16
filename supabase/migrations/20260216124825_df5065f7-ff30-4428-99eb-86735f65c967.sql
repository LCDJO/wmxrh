
-- Enums for compensation
CREATE TYPE public.salary_adjustment_type AS ENUM ('annual', 'promotion', 'adjustment', 'merit', 'correction');
CREATE TYPE public.salary_additional_type AS ENUM ('bonus', 'commission', 'allowance', 'hazard_pay', 'overtime', 'other');

-- Extend employee_event_type with new compensation events
ALTER TYPE public.employee_event_type ADD VALUE IF NOT EXISTS 'employee_hired';
ALTER TYPE public.employee_event_type ADD VALUE IF NOT EXISTS 'salary_contract_started';
ALTER TYPE public.employee_event_type ADD VALUE IF NOT EXISTS 'salary_adjusted';
ALTER TYPE public.employee_event_type ADD VALUE IF NOT EXISTS 'additional_added';
ALTER TYPE public.employee_event_type ADD VALUE IF NOT EXISTS 'job_changed';

-- ================================
-- SALARY CONTRACTS (immutable, append-only)
-- ================================
CREATE TABLE public.salary_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  base_salary numeric NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_contracts ENABLE ROW LEVEL SECURITY;

-- IMMUTABILITY: no updates or deletes allowed via RLS (only system trigger can close)
CREATE POLICY "Members can view salary contracts"
ON public.salary_contracts FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert salary contracts"
ON public.salary_contracts FOR INSERT TO authenticated
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- Block direct updates (only trigger can update end_date/is_active)
-- We allow UPDATE only via SECURITY DEFINER trigger functions

-- ================================
-- SALARY ADJUSTMENTS (immutable log)
-- ================================
CREATE TABLE public.salary_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.salary_contracts(id),
  adjustment_type public.salary_adjustment_type NOT NULL,
  percentage numeric,
  previous_salary numeric NOT NULL,
  new_salary numeric NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view salary adjustments"
ON public.salary_adjustments FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert salary adjustments"
ON public.salary_adjustments FOR INSERT TO authenticated
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- ================================
-- SALARY ADDITIONALS (benefits, bonuses)
-- ================================
CREATE TABLE public.salary_additionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  additional_type public.salary_additional_type NOT NULL,
  amount numeric NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_additionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view salary additionals"
ON public.salary_additionals FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert salary additionals"
ON public.salary_additionals FOR INSERT TO authenticated
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- ================================
-- TRIGGER: Auto-close previous contract when new one is inserted
-- ================================
CREATE OR REPLACE FUNCTION public.auto_close_previous_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Close all active contracts for this employee
  UPDATE public.salary_contracts
  SET is_active = false, end_date = NEW.start_date - INTERVAL '1 day'
  WHERE employee_id = NEW.employee_id
    AND is_active = true
    AND id != NEW.id;

  -- Log event
  INSERT INTO public.employee_events (tenant_id, employee_id, event_type, new_value, performed_by)
  VALUES (
    NEW.tenant_id,
    NEW.employee_id,
    'salary_contract_started',
    jsonb_build_object('contract_id', NEW.id, 'base_salary', NEW.base_salary, 'start_date', NEW.start_date),
    NEW.created_by
  );

  -- Update employee current_salary
  UPDATE public.employees
  SET current_salary = NEW.base_salary, base_salary = NEW.base_salary
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_close_previous_contract
AFTER INSERT ON public.salary_contracts
FOR EACH ROW
EXECUTE FUNCTION public.auto_close_previous_contract();

-- ================================
-- TRIGGER: Log salary adjustment event
-- ================================
CREATE OR REPLACE FUNCTION public.log_salary_adjustment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.employee_events (tenant_id, employee_id, event_type, old_value, new_value, performed_by)
  VALUES (
    NEW.tenant_id,
    NEW.employee_id,
    'salary_adjusted',
    jsonb_build_object('salary', NEW.previous_salary),
    jsonb_build_object('salary', NEW.new_salary, 'type', NEW.adjustment_type, 'percentage', NEW.percentage, 'reason', NEW.reason),
    NEW.created_by
  );

  -- Update employee current_salary
  UPDATE public.employees
  SET current_salary = NEW.new_salary
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_salary_adjustment
AFTER INSERT ON public.salary_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.log_salary_adjustment_event();

-- ================================
-- TRIGGER: Log additional added event
-- ================================
CREATE OR REPLACE FUNCTION public.log_additional_added_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.employee_events (tenant_id, employee_id, event_type, new_value, performed_by)
  VALUES (
    NEW.tenant_id,
    NEW.employee_id,
    'additional_added',
    jsonb_build_object('type', NEW.additional_type, 'amount', NEW.amount, 'recurring', NEW.is_recurring, 'description', NEW.description),
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_additional_added
AFTER INSERT ON public.salary_additionals
FOR EACH ROW
EXECUTE FUNCTION public.log_additional_added_event();

-- Indexes
CREATE INDEX idx_salary_contracts_employee ON public.salary_contracts(employee_id);
CREATE INDEX idx_salary_contracts_active ON public.salary_contracts(employee_id, is_active) WHERE is_active = true;
CREATE INDEX idx_salary_adjustments_employee ON public.salary_adjustments(employee_id);
CREATE INDEX idx_salary_adjustments_contract ON public.salary_adjustments(contract_id);
CREATE INDEX idx_salary_additionals_employee ON public.salary_additionals(employee_id);
