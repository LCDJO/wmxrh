
-- ══════════════════════════════════════════════════════════
-- FIX 1: Correct is_platform_user to check platform_users table
-- FIX 2: Lock down all BCDR tables to platform admins only
-- ══════════════════════════════════════════════════════════

-- ── Fix is_platform_user function ──
CREATE OR REPLACE FUNCTION public.is_platform_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id
      AND status = 'active'
  );
$$;

-- ── Drop old permissive BCDR policies ──
DROP POLICY IF EXISTS "Service role full access on bcdr_audit_log" ON public.bcdr_audit_log;
DROP POLICY IF EXISTS "Service role full access on bcdr_backups" ON public.bcdr_backups;
DROP POLICY IF EXISTS "Service role full access on bcdr_dr_tests" ON public.bcdr_dr_tests;
DROP POLICY IF EXISTS "Service role full access on bcdr_failover_records" ON public.bcdr_failover_records;
DROP POLICY IF EXISTS "Service role full access on bcdr_recovery_policies" ON public.bcdr_recovery_policies;
DROP POLICY IF EXISTS "Service role full access on bcdr_region_health" ON public.bcdr_region_health;
DROP POLICY IF EXISTS "Service role full access on bcdr_replication_status" ON public.bcdr_replication_status;

-- ── bcdr_audit_log: platform users read, service_role writes ──
CREATE POLICY "platform_read_bcdr_audit_log" ON public.bcdr_audit_log
  FOR SELECT TO authenticated
  USING (is_platform_user(auth.uid()));

CREATE POLICY "platform_insert_bcdr_audit_log" ON public.bcdr_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_user(auth.uid()));

-- ── bcdr_backups ──
CREATE POLICY "platform_read_bcdr_backups" ON public.bcdr_backups
  FOR SELECT TO authenticated
  USING (is_platform_user(auth.uid()));

CREATE POLICY "platform_insert_bcdr_backups" ON public.bcdr_backups
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_user(auth.uid()));

CREATE POLICY "platform_update_bcdr_backups" ON public.bcdr_backups
  FOR UPDATE TO authenticated
  USING (is_platform_user(auth.uid()));

-- ── bcdr_dr_tests ──
CREATE POLICY "platform_read_bcdr_dr_tests" ON public.bcdr_dr_tests
  FOR SELECT TO authenticated
  USING (is_platform_user(auth.uid()));

CREATE POLICY "platform_insert_bcdr_dr_tests" ON public.bcdr_dr_tests
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_user(auth.uid()));

CREATE POLICY "platform_update_bcdr_dr_tests" ON public.bcdr_dr_tests
  FOR UPDATE TO authenticated
  USING (is_platform_user(auth.uid()));

-- ── bcdr_failover_records ──
CREATE POLICY "platform_read_bcdr_failover_records" ON public.bcdr_failover_records
  FOR SELECT TO authenticated
  USING (is_platform_user(auth.uid()));

CREATE POLICY "platform_insert_bcdr_failover_records" ON public.bcdr_failover_records
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_user(auth.uid()));

CREATE POLICY "platform_update_bcdr_failover_records" ON public.bcdr_failover_records
  FOR UPDATE TO authenticated
  USING (is_platform_user(auth.uid()));

-- ── bcdr_recovery_policies ──
CREATE POLICY "platform_read_bcdr_recovery_policies" ON public.bcdr_recovery_policies
  FOR SELECT TO authenticated
  USING (is_platform_user(auth.uid()));

CREATE POLICY "platform_insert_bcdr_recovery_policies" ON public.bcdr_recovery_policies
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_user(auth.uid()));

CREATE POLICY "platform_update_bcdr_recovery_policies" ON public.bcdr_recovery_policies
  FOR UPDATE TO authenticated
  USING (is_platform_user(auth.uid()));

-- ── bcdr_region_health ──
CREATE POLICY "platform_read_bcdr_region_health" ON public.bcdr_region_health
  FOR SELECT TO authenticated
  USING (is_platform_user(auth.uid()));

CREATE POLICY "platform_insert_bcdr_region_health" ON public.bcdr_region_health
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_user(auth.uid()));

CREATE POLICY "platform_update_bcdr_region_health" ON public.bcdr_region_health
  FOR UPDATE TO authenticated
  USING (is_platform_user(auth.uid()));

-- ── bcdr_replication_status ──
CREATE POLICY "platform_read_bcdr_replication_status" ON public.bcdr_replication_status
  FOR SELECT TO authenticated
  USING (is_platform_user(auth.uid()));

CREATE POLICY "platform_insert_bcdr_replication_status" ON public.bcdr_replication_status
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_user(auth.uid()));

CREATE POLICY "platform_update_bcdr_replication_status" ON public.bcdr_replication_status
  FOR UPDATE TO authenticated
  USING (is_platform_user(auth.uid()));
