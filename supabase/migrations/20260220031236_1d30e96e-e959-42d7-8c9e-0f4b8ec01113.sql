
-- Add signature tracking columns to epi_deliveries
ALTER TABLE public.epi_deliveries
  ADD COLUMN IF NOT EXISTS assinatura_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS documento_assinado_url text,
  ADD COLUMN IF NOT EXISTS hash_documento text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS external_document_id text,
  ADD COLUMN IF NOT EXISTS signature_provider text;

-- Add constraint for valid signature statuses
ALTER TABLE public.epi_deliveries
  ADD CONSTRAINT chk_epi_delivery_assinatura_status
  CHECK (assinatura_status IN ('pending', 'sent', 'signed', 'rejected', 'expired'));

-- Index for querying pending signatures
CREATE INDEX IF NOT EXISTS idx_epi_deliveries_assinatura_status
  ON public.epi_deliveries(tenant_id, assinatura_status)
  WHERE assinatura_status != 'signed';

-- Trigger: emit audit log on signature status change
CREATE OR REPLACE FUNCTION public.fn_epi_signature_status_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.assinatura_status IS DISTINCT FROM NEW.assinatura_status THEN
    INSERT INTO public.epi_audit_log (tenant_id, delivery_id, employee_id, action, executor_user_id, details, metadata)
    VALUES (
      NEW.tenant_id, NEW.id, NEW.employee_id,
      CASE NEW.assinatura_status
        WHEN 'signed' THEN 'assinatura'
        ELSE 'assinatura'
      END,
      auth.uid(),
      'Status de assinatura alterado de ' || OLD.assinatura_status || ' para ' || NEW.assinatura_status,
      jsonb_build_object(
        'old_status', OLD.assinatura_status,
        'new_status', NEW.assinatura_status,
        'hash_documento', NEW.hash_documento
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_epi_signature_status_audit ON public.epi_deliveries;
CREATE TRIGGER trg_epi_signature_status_audit
  AFTER UPDATE ON public.epi_deliveries
  FOR EACH ROW
  WHEN (OLD.assinatura_status IS DISTINCT FROM NEW.assinatura_status)
  EXECUTE FUNCTION public.fn_epi_signature_status_audit();
