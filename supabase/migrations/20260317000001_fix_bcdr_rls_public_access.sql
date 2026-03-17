
-- ══════════════════════════════════════════════════════════════════
-- FIX: BCDR tables accessible without authentication
--
-- Problem: All 7 bcdr_* tables had USING (true) WITH CHECK (true)
-- policies, meaning any user (including anonymous) could read and
-- modify disaster recovery configurations.
--
-- Fix: Restrict to platform admins only (same pattern used by
-- account_enforcements, ban_registry, and other platform tables).
-- ══════════════════════════════════════════════════════════════════

-- ── bcdr_recovery_policies ───────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access on bcdr_recovery_policies" ON public.bcdr_recovery_policies;
CREATE POLICY "Platform admins manage bcdr_recovery_policies"
  ON public.bcdr_recovery_policies FOR ALL
  TO authenticated
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

-- ── bcdr_replication_status ──────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access on bcdr_replication_status" ON public.bcdr_replication_status;
CREATE POLICY "Platform admins manage bcdr_replication_status"
  ON public.bcdr_replication_status FOR ALL
  TO authenticated
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

-- ── bcdr_failover_records ────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access on bcdr_failover_records" ON public.bcdr_failover_records;
CREATE POLICY "Platform admins manage bcdr_failover_records"
  ON public.bcdr_failover_records FOR ALL
  TO authenticated
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

-- ── bcdr_backups ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access on bcdr_backups" ON public.bcdr_backups;
CREATE POLICY "Platform admins manage bcdr_backups"
  ON public.bcdr_backups FOR ALL
  TO authenticated
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

-- ── bcdr_dr_tests ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access on bcdr_dr_tests" ON public.bcdr_dr_tests;
CREATE POLICY "Platform admins manage bcdr_dr_tests"
  ON public.bcdr_dr_tests FOR ALL
  TO authenticated
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

-- ── bcdr_audit_log ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access on bcdr_audit_log" ON public.bcdr_audit_log;
CREATE POLICY "Platform admins manage bcdr_audit_log"
  ON public.bcdr_audit_log FOR ALL
  TO authenticated
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

-- ── bcdr_region_health ───────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access on bcdr_region_health" ON public.bcdr_region_health;
CREATE POLICY "Platform admins manage bcdr_region_health"
  ON public.bcdr_region_health FOR ALL
  TO authenticated
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
