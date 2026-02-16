-- Add impersonation audit columns to security_logs
ALTER TABLE public.security_logs
  ADD COLUMN IF NOT EXISTS real_user_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS active_user_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS impersonation_session_id TEXT DEFAULT NULL;

-- Add index for impersonation audit queries
CREATE INDEX IF NOT EXISTS idx_security_logs_impersonation
  ON public.security_logs (real_user_id, active_user_id)
  WHERE real_user_id IS NOT NULL;

-- Also add to audit_logs for business-level impersonation tracking
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS real_user_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS active_user_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS impersonation_session_id TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonation
  ON public.audit_logs (real_user_id, active_user_id)
  WHERE real_user_id IS NOT NULL;