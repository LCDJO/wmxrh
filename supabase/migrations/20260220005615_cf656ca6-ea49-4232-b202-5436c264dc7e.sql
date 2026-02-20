
-- Fix: Replace the overly broad ALL policy with specific INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Platform admins can manage settings" ON public.platform_settings;

CREATE POLICY "Platform admins can insert settings"
  ON public.platform_settings FOR INSERT
  WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform admins can update settings"
  ON public.platform_settings FOR UPDATE
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform admins can delete settings"
  ON public.platform_settings FOR DELETE
  USING (public.is_active_platform_user(auth.uid()));
