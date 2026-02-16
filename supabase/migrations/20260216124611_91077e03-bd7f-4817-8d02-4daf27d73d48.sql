
-- Add new columns to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_group_id uuid REFERENCES public.company_groups(id);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.employees(id);

-- Create event types enum
CREATE TYPE public.employee_event_type AS ENUM (
  'company_transfer',
  'position_change',
  'department_change',
  'status_change',
  'manager_change',
  'salary_change'
);

-- Create employee_events table (immutable audit log)
CREATE TABLE public.employee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type public.employee_event_type NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_events ENABLE ROW LEVEL SECURITY;

-- RLS: members can view, admins can insert
CREATE POLICY "Members can view employee events"
ON public.employee_events FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert employee events"
ON public.employee_events FOR INSERT TO authenticated
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- Trigger: auto-log company transfer (employee can never change company without history)
CREATE OR REPLACE FUNCTION public.log_employee_company_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    INSERT INTO public.employee_events (tenant_id, employee_id, event_type, old_value, new_value, performed_by)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      'company_transfer',
      jsonb_build_object('company_id', OLD.company_id),
      jsonb_build_object('company_id', NEW.company_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_company_transfer
BEFORE UPDATE ON public.employees
FOR EACH ROW
WHEN (OLD.company_id IS DISTINCT FROM NEW.company_id)
EXECUTE FUNCTION public.log_employee_company_transfer();

-- Trigger: auto-log position change
CREATE OR REPLACE FUNCTION public.log_employee_position_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.position_id IS DISTINCT FROM NEW.position_id THEN
    INSERT INTO public.employee_events (tenant_id, employee_id, event_type, old_value, new_value, performed_by)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      'position_change',
      jsonb_build_object('position_id', OLD.position_id),
      jsonb_build_object('position_id', NEW.position_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_position_change
BEFORE UPDATE ON public.employees
FOR EACH ROW
WHEN (OLD.position_id IS DISTINCT FROM NEW.position_id)
EXECUTE FUNCTION public.log_employee_position_change();

-- Trigger: auto-log department change
CREATE OR REPLACE FUNCTION public.log_employee_department_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.department_id IS DISTINCT FROM NEW.department_id THEN
    INSERT INTO public.employee_events (tenant_id, employee_id, event_type, old_value, new_value, performed_by)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      'department_change',
      jsonb_build_object('department_id', OLD.department_id),
      jsonb_build_object('department_id', NEW.department_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_department_change
BEFORE UPDATE ON public.employees
FOR EACH ROW
WHEN (OLD.department_id IS DISTINCT FROM NEW.department_id)
EXECUTE FUNCTION public.log_employee_department_change();

-- Trigger: auto-log status change
CREATE OR REPLACE FUNCTION public.log_employee_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.employee_events (tenant_id, employee_id, event_type, old_value, new_value, performed_by)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      'status_change',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_status_change
BEFORE UPDATE ON public.employees
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.log_employee_status_change();

-- Trigger: auto-log manager change
CREATE OR REPLACE FUNCTION public.log_employee_manager_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.manager_id IS DISTINCT FROM NEW.manager_id THEN
    INSERT INTO public.employee_events (tenant_id, employee_id, event_type, old_value, new_value, performed_by)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      'manager_change',
      jsonb_build_object('manager_id', OLD.manager_id),
      jsonb_build_object('manager_id', NEW.manager_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_manager_change
BEFORE UPDATE ON public.employees
FOR EACH ROW
WHEN (OLD.manager_id IS DISTINCT FROM NEW.manager_id)
EXECUTE FUNCTION public.log_employee_manager_change();

-- Index for fast event lookups
CREATE INDEX idx_employee_events_employee ON public.employee_events(employee_id);
CREATE INDEX idx_employee_events_tenant ON public.employee_events(tenant_id);
CREATE INDEX idx_employees_manager ON public.employees(manager_id);
CREATE INDEX idx_employees_cpf ON public.employees(cpf);
