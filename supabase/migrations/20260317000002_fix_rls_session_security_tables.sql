
-- ══════════════════════════════════════════════════════════════════
-- FIX: Session security tables accessible by any authenticated user
--
-- Problem: session_risk_analysis, security_alerts and user_devices
-- had USING (true) scoped to 'authenticated', meaning any logged-in
-- user could read security data and device info for ALL users.
--
-- Fix:
--   session_risk_analysis → tenant admins see their tenant; users see own
--   security_alerts       → tenant admins see their tenant; users see own
--   user_devices          → users see only their own devices; platform security admins see all
-- ══════════════════════════════════════════════════════════════════

-- ── session_risk_analysis ────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_risk_analysis" ON public.session_risk_analysis;
DROP POLICY IF EXISTS "system_insert_risk_analysis" ON public.session_risk_analysis;

-- Users see their own; tenant admins see their tenant
CREATE POLICY "users_read_own_risk_analysis"
  ON public.session_risk_analysis FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );

-- INSERT kept for system/edge functions via authenticated context
CREATE POLICY "system_insert_risk_analysis"
  ON public.session_risk_analysis FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
  );

-- ── security_alerts ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_sec_alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "system_insert_sec_alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "admins_update_sec_alerts" ON public.security_alerts;

-- Users see their own; tenant admins see their tenant; platform security admins see all
CREATE POLICY "read_security_alerts"
  ON public.security_alerts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );

CREATE POLICY "insert_security_alerts"
  ON public.security_alerts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
  );

-- Only tenant admins and platform security admins can update (resolve/investigate)
CREATE POLICY "update_security_alerts"
  ON public.security_alerts FOR UPDATE TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  )
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );

-- ── user_devices ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "system_insert_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "system_update_user_devices" ON public.user_devices;

-- Users see and manage only their own devices
CREATE POLICY "users_read_own_devices"
  ON public.user_devices FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin', 'platform_security_admin')
    )
  );

CREATE POLICY "users_insert_own_devices"
  ON public.user_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_devices"
  ON public.user_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
