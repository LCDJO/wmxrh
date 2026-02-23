
-- Add signed_document_id and email to document_access_logs for LGPD compliance
ALTER TABLE public.document_access_logs
  ADD COLUMN IF NOT EXISTS signed_document_id UUID,
  ADD COLUMN IF NOT EXISTS requester_email TEXT;

CREATE INDEX IF NOT EXISTS idx_dal_signed_doc ON public.document_access_logs(signed_document_id);
