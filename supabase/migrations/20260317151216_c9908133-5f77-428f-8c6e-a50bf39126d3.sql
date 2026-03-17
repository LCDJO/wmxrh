
-- ══════════════════════════════════════════════════════════
-- FIX: Harden RLS on security_alerts, user_devices, session_risk_analysis
-- ══════════════════════════════════════════════════════════

-- ── security_alerts (has tenant_id) ──

CREATE POLICY "tenant_read_sec_alerts" ON public.security_alerts
  FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant_insert_sec_alerts" ON public.security_alerts
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant_update_sec_alerts" ON public.security_alerts
  FOR UPDATE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

-- ── user_devices (scoped by user_id, no tenant_id) ──

DROP POLICY IF EXISTS "admins_read_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "system_insert_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "system_update_user_devices" ON public.user_devices;

CREATE POLICY "owner_read_user_devices" ON public.user_devices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner_insert_user_devices" ON public.user_devices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_update_user_devices" ON public.user_devices
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── session_risk_analysis (has tenant_id) ──

CREATE POLICY "tenant_read_risk_analysis" ON public.session_risk_analysis
  FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant_insert_risk_analysis" ON public.session_risk_analysis
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id));
