-- Fix: Platform SELECT policy uses is_platform_user() which checks user_roles (wrong table)
-- Replace with is_active_platform_user() which checks platform_users correctly

DROP POLICY IF EXISTS "Platform users can select all tenants" ON public.tenants;

CREATE POLICY "Platform users can select all tenants"
ON public.tenants
FOR SELECT
USING (is_active_platform_user(auth.uid()));
