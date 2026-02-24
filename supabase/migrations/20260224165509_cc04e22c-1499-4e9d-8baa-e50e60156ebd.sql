
-- Add missing columns to offboarding_audit_log for complete audit trail
ALTER TABLE public.offboarding_audit_log
  ADD COLUMN IF NOT EXISTS etapa TEXT,
  ADD COLUMN IF NOT EXISTS decisao TEXT,
  ADD COLUMN IF NOT EXISTS justificativa TEXT;

-- Add index for faster workflow lookups
CREATE INDEX IF NOT EXISTS idx_offboarding_audit_workflow ON public.offboarding_audit_log(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offboarding_audit_tenant ON public.offboarding_audit_log(tenant_id, created_at DESC);
