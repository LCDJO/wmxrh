
-- ═══════════════════════════════════════════════════════════════
-- Ban Model — Structured ban records with reason categories
-- ═══════════════════════════════════════════════════════════════

-- Add missing columns to ban_registry
ALTER TABLE public.ban_registry
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'tenant' CHECK (entity_type IN ('tenant', 'user', 'developer_app')),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS reason_category TEXT NOT NULL DEFAULT 'abuse' CHECK (reason_category IN ('fraud', 'abuse', 'security', 'legal')),
  ADD COLUMN IF NOT EXISTS reason_description TEXT,
  ADD COLUMN IF NOT EXISTS severity_level TEXT DEFAULT 'medium' CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS review_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS appeal_allowed BOOLEAN NOT NULL DEFAULT true;

-- Backfill entity_id from tenant_id
UPDATE public.ban_registry SET entity_id = tenant_id WHERE entity_id IS NULL;

-- Index for entity lookups
CREATE INDEX IF NOT EXISTS idx_ban_registry_entity ON public.ban_registry(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ban_registry_reason ON public.ban_registry(reason_category);
