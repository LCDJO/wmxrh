
-- Add entity_scope to platform_changelogs for two-layer module tracking
ALTER TABLE public.platform_changelogs
  ADD COLUMN IF NOT EXISTS entity_scope TEXT;

-- Index for efficient filtering by support module + scope
CREATE INDEX IF NOT EXISTS idx_changelogs_module_scope
  ON public.platform_changelogs (module_id, entity_scope)
  WHERE module_id IS NOT NULL;
