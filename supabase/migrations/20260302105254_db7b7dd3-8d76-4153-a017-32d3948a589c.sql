
-- 1. Block DELETE on worktime_ledger (immutability)
CREATE OR REPLACE FUNCTION public.fn_worktime_ledger_block_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Exclusão de registros de ponto é proibida (Portaria 671/2021). Use ajuste formal.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_worktime_ledger_block_delete ON public.worktime_ledger;
CREATE TRIGGER trg_worktime_ledger_block_delete
  BEFORE DELETE ON public.worktime_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_worktime_ledger_block_delete();

-- 2. Block UPDATE on critical fields (recorded_at, event_type, employee_id, integrity_hash)
-- Only allow status changes (e.g. valid → flagged by anti-fraud)
CREATE OR REPLACE FUNCTION public.fn_worktime_ledger_block_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.recorded_at IS DISTINCT FROM NEW.recorded_at THEN
    RAISE EXCEPTION 'Alteração de horário de registro é proibida. Use ajuste formal (worktime_ledger_adjustments).';
  END IF;
  IF OLD.event_type IS DISTINCT FROM NEW.event_type THEN
    RAISE EXCEPTION 'Alteração do tipo de evento é proibida. Use ajuste formal.';
  END IF;
  IF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
    RAISE EXCEPTION 'Alteração do employee_id é proibida.';
  END IF;
  IF OLD.integrity_hash IS DISTINCT FROM NEW.integrity_hash THEN
    RAISE EXCEPTION 'Alteração do hash de integridade é proibida.';
  END IF;
  IF OLD.server_signature IS DISTINCT FROM NEW.server_signature THEN
    RAISE EXCEPTION 'Alteração da assinatura do servidor é proibida.';
  END IF;
  IF OLD.previous_hash IS DISTINCT FROM NEW.previous_hash THEN
    RAISE EXCEPTION 'Alteração do hash anterior é proibida.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_worktime_ledger_block_update ON public.worktime_ledger;
CREATE TRIGGER trg_worktime_ledger_block_update
  BEFORE UPDATE ON public.worktime_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_worktime_ledger_block_update();
