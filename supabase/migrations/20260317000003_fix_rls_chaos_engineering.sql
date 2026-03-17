
-- ══════════════════════════════════════════════════════════════════
-- FIX: Chaos Engineering tables accessible by any authenticated user
--
-- Problem: chaos_scenarios, chaos_experiments and chaos_audit_log
-- had USING (true) for all authenticated users — anyone could read
-- and trigger chaos experiments against production infrastructure.
--
-- Fix: Restrict to platform admins only (same pattern as other
-- platform-level tables like account_enforcements, bcdr_*, etc.)
-- These tables have no tenant_id — they are platform-scoped.
-- ══════════════════════════════════════════════════════════════════

-- ── chaos_scenarios ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read chaos scenarios" ON public.chaos_scenarios;
DROP POLICY IF EXISTS "Authenticated users can manage chaos scenarios" ON public.chaos_scenarios;

CREATE POLICY "Platform admins manage chaos_scenarios"
  ON public.chaos_scenarios FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );

-- ── chaos_experiments ────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read chaos experiments" ON public.chaos_experiments;
DROP POLICY IF EXISTS "Authenticated users can manage chaos experiments" ON public.chaos_experiments;

CREATE POLICY "Platform admins manage chaos_experiments"
  ON public.chaos_experiments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );

-- ── chaos_audit_log ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read chaos audit log" ON public.chaos_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert chaos audit log" ON public.chaos_audit_log;

CREATE POLICY "Platform admins read chaos_audit_log"
  ON public.chaos_audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );

CREATE POLICY "Platform admins insert chaos_audit_log"
  ON public.chaos_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );
