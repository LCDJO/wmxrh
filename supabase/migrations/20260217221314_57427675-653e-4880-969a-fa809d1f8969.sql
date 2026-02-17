
-- ══════════════════════════════════════════════════════════════════
-- Platform Versioning — Real Database Persistence
-- ══════════════════════════════════════════════════════════════════

-- 1. Platform Versions
CREATE TABLE public.platform_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_major INTEGER NOT NULL DEFAULT 0,
  version_minor INTEGER NOT NULL DEFAULT 0,
  version_patch INTEGER NOT NULL DEFAULT 0,
  version_prerelease TEXT,
  version_build TEXT,
  version_tag TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  release_type TEXT NOT NULL DEFAULT 'feature',
  modules_included TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  release_id UUID,
  changelog_entries TEXT[] NOT NULL DEFAULT '{}',
  released_by TEXT NOT NULL,
  released_at TIMESTAMPTZ,
  rollback_from UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_users_read_versions" ON public.platform_versions
  FOR SELECT USING (is_active_platform_user(auth.uid()));

CREATE POLICY "platform_admins_manage_versions" ON public.platform_versions
  FOR ALL USING (is_active_platform_user(auth.uid()))
  WITH CHECK (is_active_platform_user(auth.uid()));

-- 2. Module Versions
CREATE TABLE public.module_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id TEXT NOT NULL,
  version_major INTEGER NOT NULL DEFAULT 0,
  version_minor INTEGER NOT NULL DEFAULT 0,
  version_patch INTEGER NOT NULL DEFAULT 0,
  version_prerelease TEXT,
  version_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  breaking_changes BOOLEAN NOT NULL DEFAULT false,
  dependencies JSONB NOT NULL DEFAULT '[]',
  changelog_summary TEXT NOT NULL DEFAULT '',
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

CREATE INDEX idx_module_versions_module ON public.module_versions (module_id, status);

ALTER TABLE public.module_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_users_read_module_versions" ON public.module_versions
  FOR SELECT USING (is_active_platform_user(auth.uid()));

CREATE POLICY "platform_admins_manage_module_versions" ON public.module_versions
  FOR ALL USING (is_active_platform_user(auth.uid()))
  WITH CHECK (is_active_platform_user(auth.uid()));

-- 3. Platform Changelogs (primary + legacy in one table)
CREATE TABLE public.platform_changelogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  payload_diff JSONB NOT NULL DEFAULT '{}',
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Legacy fields (nullable, used by ChangelogRenderer)
  category TEXT,
  scope TEXT,
  scope_key TEXT,
  title TEXT,
  description TEXT,
  author TEXT,
  linked_version_id UUID,
  linked_release_id UUID,
  tags TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_changelogs_module ON public.platform_changelogs (module_id);
CREATE INDEX idx_changelogs_entity ON public.platform_changelogs (entity_type, entity_id);
CREATE INDEX idx_changelogs_version_tag ON public.platform_changelogs (version_tag);

ALTER TABLE public.platform_changelogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_users_read_changelogs" ON public.platform_changelogs
  FOR SELECT USING (is_active_platform_user(auth.uid()));

CREATE POLICY "platform_admins_manage_changelogs" ON public.platform_changelogs
  FOR ALL USING (is_active_platform_user(auth.uid()))
  WITH CHECK (is_active_platform_user(auth.uid()));

-- 4. Releases
CREATE TABLE public.versioning_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  platform_version_id UUID REFERENCES public.platform_versions(id),
  module_versions UUID[] NOT NULL DEFAULT '{}',
  changelog_entries UUID[] NOT NULL DEFAULT '{}',
  dependency_snapshot JSONB NOT NULL DEFAULT '{"timestamp":"","modules":[],"conflicts":[]}',
  pre_checks JSONB NOT NULL DEFAULT '[]',
  promoted_to_candidate_by TEXT,
  promoted_to_candidate_at TIMESTAMPTZ,
  finalized_by TEXT,
  finalized_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

ALTER TABLE public.versioning_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_users_read_releases" ON public.versioning_releases
  FOR SELECT USING (is_active_platform_user(auth.uid()));

CREATE POLICY "platform_admins_manage_releases" ON public.versioning_releases
  FOR ALL USING (is_active_platform_user(auth.uid()))
  WITH CHECK (is_active_platform_user(auth.uid()));

-- 5. Feature Changes
CREATE TABLE public.feature_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL,
  change_type TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB NOT NULL DEFAULT '{}',
  module_key TEXT,
  version_id UUID,
  author TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_changes_feature ON public.feature_changes (feature_key);
CREATE INDEX idx_feature_changes_module ON public.feature_changes (module_key);

ALTER TABLE public.feature_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_users_read_feature_changes" ON public.feature_changes
  FOR SELECT USING (is_active_platform_user(auth.uid()));

CREATE POLICY "platform_admins_manage_feature_changes" ON public.feature_changes
  FOR ALL USING (is_active_platform_user(auth.uid()))
  WITH CHECK (is_active_platform_user(auth.uid()));

-- 6. Rollback Plans
CREATE TABLE public.rollback_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'release',
  release_id UUID,
  target_release_id UUID,
  modules_affected TEXT[] NOT NULL DEFAULT '{}',
  modules_skipped TEXT[] NOT NULL DEFAULT '{}',
  dependency_safe BOOLEAN NOT NULL DEFAULT true,
  breaking_rollback BOOLEAN NOT NULL DEFAULT false,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

ALTER TABLE public.rollback_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_users_read_rollback_plans" ON public.rollback_plans
  FOR SELECT USING (is_active_platform_user(auth.uid()));

CREATE POLICY "platform_admins_manage_rollback_plans" ON public.rollback_plans
  FOR ALL USING (is_active_platform_user(auth.uid()))
  WITH CHECK (is_active_platform_user(auth.uid()));
