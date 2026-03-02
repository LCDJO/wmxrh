
-- Add requested_by and requested_at to adjustments
ALTER TABLE public.worktime_ledger_adjustments
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now();

-- Immutability: block DELETE on adjustments (append-only)
CREATE OR REPLACE FUNCTION public.fn_worktime_adjustments_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'worktime_ledger_adjustments is append-only. Deletes are forbidden.';
  END IF;
  -- Allow UPDATE only for approval_status changes
  IF TG_OP = 'UPDATE' THEN
    IF OLD.reason IS DISTINCT FROM NEW.reason
       OR OLD.original_entry_id IS DISTINCT FROM NEW.original_entry_id
       OR OLD.adjustment_type IS DISTINCT FROM NEW.adjustment_type
       OR OLD.integrity_hash IS DISTINCT FROM NEW.integrity_hash THEN
      RAISE EXCEPTION 'Only approval fields can be updated on adjustments.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worktime_adjustments_immutable ON public.worktime_ledger_adjustments;
CREATE TRIGGER trg_worktime_adjustments_immutable
  BEFORE UPDATE OR DELETE ON public.worktime_ledger_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_adjustments_immutable();
