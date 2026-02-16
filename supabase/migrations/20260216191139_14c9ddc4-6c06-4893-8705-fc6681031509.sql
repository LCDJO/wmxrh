
-- ═══════════════════════════════════════════════════════
-- ALIGN ENTITIES: TenantUser, Permission
-- ═══════════════════════════════════════════════════════

-- 1) TenantUser: Add name, email, status, created_by to tenant_memberships
ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_status ON public.tenant_memberships(tenant_id, status);

-- 2) Permission: Add resource and action columns to permission_definitions
ALTER TABLE public.permission_definitions
  ADD COLUMN IF NOT EXISTS resource TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT;

-- Backfill resource/action from existing code (e.g. 'companies.view' → resource='companies', action='view')
UPDATE public.permission_definitions
SET
  resource = split_part(code, '.', 1),
  action = split_part(code, '.', 2)
WHERE resource IS NULL;

-- Make them NOT NULL after backfill
ALTER TABLE public.permission_definitions
  ALTER COLUMN resource SET NOT NULL,
  ALTER COLUMN action SET NOT NULL;

-- Index for resource+action lookups
CREATE INDEX IF NOT EXISTS idx_permission_definitions_resource_action 
  ON public.permission_definitions(resource, action);
