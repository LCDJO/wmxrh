-- 1. Add status_operacional column to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status_operacional text NOT NULL DEFAULT 'liberado';

-- 2. Create function to check and block employees missing mandatory EPIs
CREATE OR REPLACE FUNCTION public.fn_check_epi_operational_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _employee_id uuid;
  _tenant_id uuid;
  _missing_count int;
  _current_status text;
BEGIN
  -- Determine employee from the affected delivery
  IF TG_OP = 'DELETE' THEN
    _employee_id := OLD.employee_id;
    _tenant_id := OLD.tenant_id;
  ELSE
    _employee_id := NEW.employee_id;
    _tenant_id := NEW.tenant_id;
  END IF;

  -- Count pending mandatory EPI requirements
  SELECT COUNT(*) INTO _missing_count
  FROM public.epi_requirements
  WHERE employee_id = _employee_id
    AND tenant_id = _tenant_id
    AND status = 'pendente'
    AND obrigatorio = true;

  -- Get current operational status
  SELECT status_operacional INTO _current_status
  FROM public.employees
  WHERE id = _employee_id;

  IF _missing_count > 0 AND _current_status IS DISTINCT FROM 'bloqueado' THEN
    -- Block the employee
    UPDATE public.employees
    SET status_operacional = 'bloqueado'
    WHERE id = _employee_id;

    -- Log the event
    INSERT INTO public.employee_events (tenant_id, employee_id, event_type, new_value, performed_by)
    VALUES (
      _tenant_id, _employee_id, 'EmployeeOperationBlockedByEPI',
      jsonb_build_object('missing_mandatory_epis', _missing_count, 'blocked_at', now()),
      auth.uid()
    );

    -- Log in EPI audit
    INSERT INTO public.epi_audit_log (tenant_id, employee_id, action, executor, details, metadata)
    VALUES (
      _tenant_id, _employee_id, 'bloqueio_operacional', 'system',
      'Colaborador bloqueado por falta de EPI obrigatório',
      jsonb_build_object('missing_count', _missing_count)
    );

  ELSIF _missing_count = 0 AND _current_status = 'bloqueado' THEN
    -- Unblock
    UPDATE public.employees
    SET status_operacional = 'liberado'
    WHERE id = _employee_id;

    INSERT INTO public.employee_events (tenant_id, employee_id, event_type, new_value, performed_by)
    VALUES (
      _tenant_id, _employee_id, 'EmployeeOperationUnblockedByEPI',
      jsonb_build_object('unblocked_at', now()),
      auth.uid()
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- 3. Trigger on epi_deliveries changes (status changes like vencido, devolvido, etc.)
CREATE TRIGGER trg_epi_operational_block_delivery
AFTER INSERT OR UPDATE OF status ON public.epi_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_epi_operational_block();

-- 4. Trigger on epi_requirements changes (new mandatory requirement created or fulfilled)
CREATE TRIGGER trg_epi_operational_block_requirement
AFTER INSERT OR UPDATE OF status ON public.epi_requirements
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_epi_operational_block();
