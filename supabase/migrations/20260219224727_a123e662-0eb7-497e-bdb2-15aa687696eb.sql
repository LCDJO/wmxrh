
-- Add version_tag and is_current to existing table
ALTER TABLE public.integration_workflow_versions
  ADD COLUMN IF NOT EXISTS version_tag TEXT,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT false;

-- Unique constraint on workflow + version_tag
CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_versions_workflow_tag
  ON public.integration_workflow_versions(workflow_id, version_tag);

-- Partial index for fast current-version lookups
CREATE INDEX IF NOT EXISTS idx_wf_versions_current
  ON public.integration_workflow_versions(workflow_id, is_current) WHERE is_current = true;

-- Trigger: ensure only one is_current per workflow
CREATE OR REPLACE FUNCTION public.fn_ensure_single_current_wf_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.integration_workflow_versions
    SET is_current = false
    WHERE workflow_id = NEW.workflow_id AND id != NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_ensure_single_current_wf_version ON public.integration_workflow_versions;
CREATE TRIGGER trg_ensure_single_current_wf_version
  BEFORE INSERT OR UPDATE ON public.integration_workflow_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ensure_single_current_wf_version();
