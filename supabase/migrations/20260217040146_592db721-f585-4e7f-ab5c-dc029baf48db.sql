-- Fix infinite recursion in platform_roles RLS policy
-- The writable policy does an inline subquery on platform_users → platform_roles → recursion
-- Replace with SECURITY DEFINER function call that bypasses RLS

DROP POLICY IF EXISTS "Platform roles writable by super admins" ON public.platform_roles;

CREATE POLICY "Platform roles writable by super admins"
ON public.platform_roles
FOR ALL
TO authenticated
USING (has_platform_role(auth.uid(), 'platform_super_admin'))
WITH CHECK (has_platform_role(auth.uid(), 'platform_super_admin'));