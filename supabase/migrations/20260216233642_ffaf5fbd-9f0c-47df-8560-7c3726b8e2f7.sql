
-- ══════════════════════════════════════════════════════════════
-- Security: Only platform admins with plan.manage can modify tenant_plans
-- Tenants are completely blocked from altering their own plans.
-- ══════════════════════════════════════════════════════════════

-- 1) Security definer function: checks if platform user has a specific permission
CREATE OR REPLACE FUNCTION public.has_platform_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_users pu
    JOIN public.platform_role_permissions prp ON prp.role = pu.role
    JOIN public.platform_permission_definitions ppd ON ppd.id = prp.permission_id
    WHERE pu.user_id = _user_id
      AND ppd.code = _permission
  )
$$;

-- 2) Seed the plan.manage permission
INSERT INTO public.platform_permission_definitions (code, module, description)
VALUES ('plan.manage', 'billing', 'Gerenciar planos de tenants (criar, alterar, remover)')
ON CONFLICT (code) DO NOTHING;

-- 3) Grant plan.manage to superadmin and finance roles
INSERT INTO public.platform_role_permissions (role, permission_id)
SELECT 'platform_super_admin'::platform_role, ppd.id
FROM public.platform_permission_definitions ppd
WHERE ppd.code = 'plan.manage'
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_role_permissions (role, permission_id)
SELECT 'platform_finance'::platform_role, ppd.id
FROM public.platform_permission_definitions ppd
WHERE ppd.code = 'plan.manage'
ON CONFLICT DO NOTHING;

-- 4) Drop existing policies on tenant_plans
DROP POLICY IF EXISTS "Authenticated users can view tenant plans" ON public.tenant_plans;
DROP POLICY IF EXISTS "Platform admins can manage tenant plans" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_select" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_insert" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_update" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_delete" ON public.tenant_plans;

-- 5) Ensure RLS is enabled
ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

-- 6) SELECT: Tenants can view their own plan (read-only). Platform admins with plan.manage can view all.
CREATE POLICY "tenant_plans_select"
ON public.tenant_plans
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  OR public.has_platform_permission(auth.uid(), 'plan.manage')
);

-- 7) INSERT: Only platform users with plan.manage
CREATE POLICY "tenant_plans_insert"
ON public.tenant_plans
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_platform_permission(auth.uid(), 'plan.manage')
);

-- 8) UPDATE: Only platform users with plan.manage
CREATE POLICY "tenant_plans_update"
ON public.tenant_plans
FOR UPDATE
TO authenticated
USING (public.has_platform_permission(auth.uid(), 'plan.manage'))
WITH CHECK (public.has_platform_permission(auth.uid(), 'plan.manage'));

-- 9) DELETE: Only platform users with plan.manage
CREATE POLICY "tenant_plans_delete"
ON public.tenant_plans
FOR DELETE
TO authenticated
USING (public.has_platform_permission(auth.uid(), 'plan.manage'));
