
-- Add structured audit columns to enforcement_audit_log
ALTER TABLE public.enforcement_audit_log
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS previous_status TEXT,
  ADD COLUMN IF NOT EXISTS new_status TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS executor UUID;

-- Index for entity lookups
CREATE INDEX IF NOT EXISTS idx_enforcement_audit_log_entity ON public.enforcement_audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_audit_log_action ON public.enforcement_audit_log(action);
