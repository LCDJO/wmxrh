
-- Add scope columns to custom_roles for group-scoped roles
ALTER TABLE public.custom_roles
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS scope_id uuid DEFAULT NULL;

-- Helper: check if user is group_admin for a specific group
CREATE OR REPLACE FUNCTION public.user_is_group_admin(_user_id uuid, _tenant_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = 'group_admin'
      AND scope_type = 'company_group'
      AND scope_id = _group_id
  )
$$;

-- Helper: check if user is company_admin
CREATE OR REPLACE FUNCTION public.user_is_company_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = 'company_admin'
  )
$$;

-- ══════════════════════════════════════
-- custom_roles: Allow group_admin to create group-scoped roles
-- ══════════════════════════════════════

-- Drop existing INSERT policy and replace with expanded one
DROP POLICY IF EXISTS "Admins can create custom roles" ON public.custom_roles;
CREATE POLICY "Admins and group admins can create custom roles"
ON public.custom_roles FOR INSERT
WITH CHECK (
  -- TenantAdmin can create any role
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR
  -- GroupAdmin can create roles scoped to their group
  (
    scope_type = 'company_group'
    AND scope_id IS NOT NULL
    AND public.user_is_group_admin(auth.uid(), tenant_id, scope_id)
  )
);

-- Drop existing UPDATE policy and replace
DROP POLICY IF EXISTS "Admins can update custom roles" ON public.custom_roles;
CREATE POLICY "Admins and group admins can update custom roles"
ON public.custom_roles FOR UPDATE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR
  (
    scope_type = 'company_group'
    AND scope_id IS NOT NULL
    AND public.user_is_group_admin(auth.uid(), tenant_id, scope_id)
  )
);

-- Delete: only tenant admin (group_admin cannot delete)
-- Keep existing policy as-is (already tenant_admin only)

-- ══════════════════════════════════════
-- role_inheritance: Block company_admin explicitly
-- ══════════════════════════════════════

-- Replace INSERT policy: tenant_admin only, explicitly deny company_admin
DROP POLICY IF EXISTS "Tenant admins can manage role inheritance" ON public.role_inheritance;
CREATE POLICY "Only tenant admins can create role inheritance"
ON public.role_inheritance FOR INSERT
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND NOT public.user_is_company_admin(auth.uid(), tenant_id)
);

-- Replace DELETE policy
DROP POLICY IF EXISTS "Tenant admins can delete role inheritance" ON public.role_inheritance;
CREATE POLICY "Only tenant admins can delete role inheritance"
ON public.role_inheritance FOR DELETE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND NOT public.user_is_company_admin(auth.uid(), tenant_id)
);

-- ══════════════════════════════════════
-- role_permissions: Allow group_admin for group-scoped roles
-- ══════════════════════════════════════

DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins and group admins can manage role permissions"
ON public.role_permissions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.custom_roles cr
    WHERE cr.id = role_permissions.role_id
    AND (
      public.is_tenant_admin(auth.uid(), cr.tenant_id)
      OR (
        cr.scope_type = 'company_group'
        AND cr.scope_id IS NOT NULL
        AND public.user_is_group_admin(auth.uid(), cr.tenant_id, cr.scope_id)
      )
    )
  )
);

DROP POLICY IF EXISTS "Admins can delete role permissions" ON public.role_permissions;
CREATE POLICY "Admins and group admins can delete role permissions"
ON public.role_permissions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.custom_roles cr
    WHERE cr.id = role_permissions.role_id
    AND (
      public.is_tenant_admin(auth.uid(), cr.tenant_id)
      OR (
        cr.scope_type = 'company_group'
        AND cr.scope_id IS NOT NULL
        AND public.user_is_group_admin(auth.uid(), cr.tenant_id, cr.scope_id)
      )
    )
  )
);
