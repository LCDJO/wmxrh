
-- Add server_signature column to worktime_ledger
-- Must temporarily drop immutability trigger to ALTER

DROP TRIGGER IF EXISTS trg_worktime_ledger_no_update ON public.worktime_ledger;

ALTER TABLE public.worktime_ledger
  ADD COLUMN IF NOT EXISTS server_signature text,
  ADD COLUMN IF NOT EXISTS signature_algorithm text DEFAULT 'HMAC-SHA256';

-- Recreate immutability trigger allowing status transitions only
CREATE OR REPLACE FUNCTION public.fn_worktime_ledger_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow only status changes (for anti-fraud flagging)
  IF NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status = 'valid'
     AND NEW.status IN ('rejected', 'flagged')
  THEN
    IF NEW.recorded_at = OLD.recorded_at
       AND NEW.event_type = OLD.event_type
       AND NEW.employee_id = OLD.employee_id
       AND NEW.integrity_hash = OLD.integrity_hash
       AND NEW.server_signature IS NOT DISTINCT FROM OLD.server_signature
    THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'worktime_ledger is immutable — only status transitions (valid→rejected/flagged) are allowed (Portaria 671/2021)';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_worktime_ledger_no_update
  BEFORE UPDATE ON public.worktime_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_ledger_immutable();

-- Also add server_signature to adjustments
DROP TRIGGER IF EXISTS trg_worktime_adj_no_update ON public.worktime_ledger_adjustments;

ALTER TABLE public.worktime_ledger_adjustments
  ADD COLUMN IF NOT EXISTS server_signature text;

CREATE TRIGGER trg_worktime_adj_no_update
  BEFORE UPDATE ON public.worktime_ledger_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_adj_immutable();
