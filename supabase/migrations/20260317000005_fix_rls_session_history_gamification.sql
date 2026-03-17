
-- ══════════════════════════════════════════════════════════════════
-- FIX: session_history INSERT unrestricted + gamification_profiles
--
-- 1. session_history: WITH CHECK (true) allowed any authenticated user
--    to insert session history for ANY user/tenant — enabling forgery
--    of IP, geolocation, risk_score and device fingerprint records.
--    Fix: restrict INSERT to own user within own tenant.
--
-- 2. gamification_profiles: USING (true) exposed points, badges and
--    streaks of all users to any authenticated user (no tenant_id).
--    Fix: users see only their own profile; platform admins see all.
-- ══════════════════════════════════════════════════════════════════

-- ── session_history ──────────────────────────────────────────────
DROP POLICY IF EXISTS "System can insert session history" ON public.session_history;

CREATE POLICY "Users insert own session history"
  ON public.session_history FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

-- ── gamification_profiles ────────────────────────────────────────
DROP POLICY IF EXISTS "view_all_profiles" ON public.gamification_profiles;

CREATE POLICY "Users view own gamification profile"
  ON public.gamification_profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin', 'platform_admin')
    )
  );
