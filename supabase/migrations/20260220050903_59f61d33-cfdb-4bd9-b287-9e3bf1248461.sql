
-- Helper: check if user has admin or HR role in a tenant
CREATE OR REPLACE FUNCTION public.user_is_admin_or_hr(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
    AND role::text IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'hr_manager', 'hr')
  )
$$;

-- Replace the SELECT policy to restrict to Admin + HR only
DROP POLICY IF EXISTS "Tenant admins can view interpretation logs" ON public.legal_interpretation_logs;

CREATE POLICY "Admin and HR can view interpretation logs"
  ON public.legal_interpretation_logs FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_hr(auth.uid(), tenant_id));
