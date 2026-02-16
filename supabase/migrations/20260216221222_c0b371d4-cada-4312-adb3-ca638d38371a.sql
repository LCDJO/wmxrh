-- Fix: Allow platform users to read their own record from platform_users
-- The current is_platform_user() function checks user_roles for 'admin' role,
-- which doesn't match platform_users. We need a self-read policy.

-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Platform super admins can select all platform users" ON public.platform_users;

-- Create two policies:
-- 1. Users can read their own platform_users record (needed for login detection)
CREATE POLICY "Users can read own platform record"
ON public.platform_users
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Platform super admins can read ALL records (for admin management)
CREATE POLICY "Platform admins can read all platform users"
ON public.platform_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
      AND pu.role = 'platform_super_admin'
      AND pu.status = 'active'
  )
);