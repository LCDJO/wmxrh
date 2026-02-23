-- Add document hash to agreement_template_versions for integrity verification
ALTER TABLE public.agreement_template_versions
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

COMMENT ON COLUMN public.agreement_template_versions.content_hash IS 'SHA-256 hash of content_html for tamper detection and version integrity';

-- Add index for hash lookups
CREATE INDEX IF NOT EXISTS idx_atv_content_hash ON public.agreement_template_versions(content_hash) WHERE content_hash IS NOT NULL;
