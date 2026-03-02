
-- Add status field to worktime_ledger (valid | rejected | flagged)
-- Must temporarily disable immutability trigger to ALTER
DROP TRIGGER IF EXISTS trg_worktime_ledger_no_update ON public.worktime_ledger;

ALTER TABLE public.worktime_ledger
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid','rejected','flagged'));

-- Re-create immutability trigger but allow status updates only by system
CREATE OR REPLACE FUNCTION public.fn_worktime_ledger_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow only status changes (for anti-fraud flagging)
  IF NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status = 'valid'
     AND NEW.status IN ('rejected', 'flagged')
  THEN
    -- Ensure no other column changed
    IF NEW.recorded_at = OLD.recorded_at
       AND NEW.event_type = OLD.event_type
       AND NEW.employee_id = OLD.employee_id
       AND NEW.integrity_hash = OLD.integrity_hash
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

CREATE INDEX IF NOT EXISTS idx_worktime_ledger_status ON public.worktime_ledger(tenant_id, status);
