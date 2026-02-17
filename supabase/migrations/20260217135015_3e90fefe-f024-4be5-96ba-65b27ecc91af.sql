-- Fix gamification_levels: only PlatformSuperAdmin/PlatformFinance can manage
DROP POLICY IF EXISTS "admin_manage_levels" ON public.gamification_levels;
CREATE POLICY "platform_admin_manage_levels"
  ON public.gamification_levels
  FOR ALL
  TO authenticated
  USING (is_platform_billing_admin(auth.uid()))
  WITH CHECK (is_platform_billing_admin(auth.uid()));

-- Fix gamification_point_weights: only PlatformSuperAdmin/PlatformFinance can manage
DROP POLICY IF EXISTS "admin_manage_weights" ON public.gamification_point_weights;
CREATE POLICY "platform_admin_manage_weights"
  ON public.gamification_point_weights
  FOR ALL
  TO authenticated
  USING (is_platform_billing_admin(auth.uid()))
  WITH CHECK (is_platform_billing_admin(auth.uid()));