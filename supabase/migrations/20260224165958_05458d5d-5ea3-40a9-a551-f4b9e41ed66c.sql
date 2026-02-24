
-- SECURITY: Granular Access Control Functions

CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'superadmin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.role_permissions rp ON rp.role_id = ucr.role_id
    WHERE ucr.user_id = p_user_id
      AND rp.permission_id::text = p_permission
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_employee_data(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    WHERE tm.user_id = p_user_id
      AND tm.tenant_id = p_tenant_id
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id
        AND ur.tenant_id = p_tenant_id
        AND ur.role IN ('superadmin', 'admin', 'rh', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_custom_roles ucr
      JOIN public.custom_roles cr ON cr.id = ucr.role_id
      WHERE ucr.user_id = p_user_id
        AND cr.tenant_id = p_tenant_id
        AND cr.is_active = true
    )
  );
$$;
