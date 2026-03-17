
-- ══════════════════════════════════════════════════════════════════
-- FIX: platform_roles and platform_access_scopes readable by anyone
--
-- Problem: SELECT policies used USING (true) for 'authenticated',
-- exposing internal platform role slugs and access scope config
-- to regular tenant users.
--
-- Fix: Restrict SELECT to platform users only (is_platform_user).
-- Write policies already restricted to platform_super_admin — kept.
-- permission_definitions intentionally left open (tenant UI needs it).
-- ══════════════════════════════════════════════════════════════════

-- ── platform_roles ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Platform roles readable by authenticated" ON public.platform_roles;

CREATE POLICY "Platform roles readable by platform users"
  ON public.platform_roles FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()));

-- ── platform_access_scopes ───────────────────────────────────────
DROP POLICY IF EXISTS "Access scopes readable by authenticated" ON public.platform_access_scopes;

CREATE POLICY "Access scopes readable by platform users"
  ON public.platform_access_scopes FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()));
