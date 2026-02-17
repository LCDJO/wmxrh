CREATE OR REPLACE FUNCTION public.user_can_see_notification(
  _user_id uuid,
  _tenant_id uuid,
  _group_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_tenant_scope boolean;
BEGIN
  -- Check tenant-wide access via membership role
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = _user_id
      AND tm.tenant_id = _tenant_id
      AND tm.role IN ('superadmin', 'owner', 'admin', 'tenant_admin')
  ) INTO _has_tenant_scope;

  IF _has_tenant_scope THEN RETURN true; END IF;

  -- Check tenant-wide access via user_roles
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.tenant_id = _tenant_id
      AND ur.scope_type = 'tenant'
  ) INTO _has_tenant_scope;

  IF _has_tenant_scope THEN RETURN true; END IF;

  -- Check group access
  IF _group_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.tenant_id = _tenant_id
        AND (
          (ur.scope_type = 'company_group' AND ur.scope_id = _group_id)
          OR (ur.scope_type = 'company' AND ur.scope_id IN (
            SELECT c.id FROM companies c WHERE c.company_group_id = _group_id
          ))
        )
    ) THEN RETURN false; END IF;
  END IF;

  -- Check company access
  IF _company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.tenant_id = _tenant_id
        AND (
          (ur.scope_type = 'company' AND ur.scope_id = _company_id)
          OR (ur.scope_type = 'company_group' AND ur.scope_id IN (
            SELECT c.company_group_id FROM companies c WHERE c.id = _company_id AND c.company_group_id IS NOT NULL
          ))
        )
    ) THEN RETURN false; END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE POLICY "Users see notifications within their access graph"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()
  )
  AND public.user_can_see_notification(auth.uid(), tenant_id, group_id, company_id)
);