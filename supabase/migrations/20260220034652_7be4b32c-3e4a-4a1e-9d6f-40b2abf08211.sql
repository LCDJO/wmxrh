
-- Function: Check if employee with active risk exposure has no active EPI delivery
-- If so: block operationally + flag for risk score increase
CREATE OR REPLACE FUNCTION public.fn_risk_epi_compliance_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _emp RECORD;
  _missing_count INT;
  _current_status TEXT;
  _current_score NUMERIC;
BEGIN
  -- Gather all employees affected by this change
  FOR _emp IN
    SELECT DISTINCT ere.employee_id, ere.tenant_id
    FROM public.employee_risk_exposures ere
    WHERE ere.is_active = true
      AND ere.requires_epi = true
      AND ere.deleted_at IS NULL
      AND ere.tenant_id = COALESCE(
        CASE WHEN TG_TABLE_NAME = 'employee_risk_exposures' THEN
          CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END
        WHEN TG_TABLE_NAME = 'epi_deliveries' THEN
          CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END
        END,
        ere.tenant_id
      )
      AND ere.employee_id = COALESCE(
        CASE WHEN TG_OP = 'DELETE' THEN OLD.employee_id ELSE NEW.employee_id END,
        ere.employee_id
      )
  LOOP
    -- Count risk exposures requiring EPI but with NO active delivery
    SELECT COUNT(*) INTO _missing_count
    FROM public.employee_risk_exposures ere
    WHERE ere.employee_id = _emp.employee_id
      AND ere.tenant_id = _emp.tenant_id
      AND ere.is_active = true
      AND ere.requires_epi = true
      AND ere.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.epi_deliveries ed
        WHERE ed.employee_id = _emp.employee_id
          AND ed.tenant_id = _emp.tenant_id
          AND ed.status = 'entregue'
          AND ed.epi_catalog_id IN (
            SELECT erm.epi_catalog_id
            FROM public.epi_risk_mappings erm
            WHERE erm.tenant_id = _emp.tenant_id
              AND erm.obrigatorio = true
          )
      );

    SELECT status_operacional INTO _current_status
    FROM public.employees WHERE id = _emp.employee_id;

    IF _missing_count > 0 THEN
      -- Block if not already blocked
      IF _current_status IS DISTINCT FROM 'bloqueado' THEN
        UPDATE public.employees
        SET status_operacional = 'bloqueado'
        WHERE id = _emp.employee_id;

        INSERT INTO public.employee_events (tenant_id, employee_id, event_type, new_value, performed_by)
        VALUES (
          _emp.tenant_id, _emp.employee_id, 'EmployeeOperationBlockedByEPI',
          jsonb_build_object('missing_epi_for_risks', _missing_count, 'blocked_at', now()),
          auth.uid()
        );
      END IF;

      -- Increase risk score: update the latest active exposure with a higher risk_score
      UPDATE public.employee_risk_exposures
      SET risk_score = LEAST(COALESCE(risk_score, 0) + (_missing_count * 15), 100)
      WHERE employee_id = _emp.employee_id
        AND tenant_id = _emp.tenant_id
        AND is_active = true
        AND deleted_at IS NULL
        AND id = (
          SELECT id FROM public.employee_risk_exposures
          WHERE employee_id = _emp.employee_id AND tenant_id = _emp.tenant_id
            AND is_active = true AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 1
        );

      -- Audit log
      INSERT INTO public.audit_logs (tenant_id, action, entity_type, entity_id, new_value)
      VALUES (
        _emp.tenant_id, 'epi_risk_block_applied', 'employee', _emp.employee_id::text,
        jsonb_build_object('missing_epi_risks', _missing_count, 'action', 'block_and_increase_score')
      );

    ELSIF _missing_count = 0 AND _current_status = 'bloqueado' THEN
      -- Unblock
      UPDATE public.employees
      SET status_operacional = 'liberado'
      WHERE id = _emp.employee_id;

      INSERT INTO public.employee_events (tenant_id, employee_id, event_type, new_value, performed_by)
      VALUES (
        _emp.tenant_id, _emp.employee_id, 'EmployeeOperationUnblockedByEPI',
        jsonb_build_object('unblocked_at', now()),
        auth.uid()
      );
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Add risk_score column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employee_risk_exposures' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE public.employee_risk_exposures ADD COLUMN risk_score NUMERIC(5,2) DEFAULT 0;
  END IF;
END $$;

-- Trigger on risk exposure changes (new risk added / deactivated)
DROP TRIGGER IF EXISTS trg_risk_epi_check_on_exposure ON public.employee_risk_exposures;
CREATE TRIGGER trg_risk_epi_check_on_exposure
  AFTER INSERT OR UPDATE OF is_active, requires_epi, deleted_at ON public.employee_risk_exposures
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_risk_epi_compliance_check();

-- Trigger on EPI delivery changes (delivered / returned / expired)
DROP TRIGGER IF EXISTS trg_risk_epi_check_on_delivery ON public.epi_deliveries;
CREATE TRIGGER trg_risk_epi_check_on_delivery
  AFTER INSERT OR UPDATE OF status ON public.epi_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_risk_epi_compliance_check();
