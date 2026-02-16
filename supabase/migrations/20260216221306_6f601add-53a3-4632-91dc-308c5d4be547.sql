-- Fix infinite recursion: create a SECURITY DEFINER function to check platform role
CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id uuid, _role platform_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id
      AND role = _role
      AND status = 'active'
  );
$$;

-- Also create a generic check
CREATE OR REPLACE FUNCTION public.is_active_platform_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id
      AND status = 'active'
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Platform admins can read all platform users" ON public.platform_users;

-- Recreate using the SECURITY DEFINER function
CREATE POLICY "Platform admins can read all platform users"
ON public.platform_users
FOR SELECT
USING (
  is_active_platform_user(auth.uid())
);