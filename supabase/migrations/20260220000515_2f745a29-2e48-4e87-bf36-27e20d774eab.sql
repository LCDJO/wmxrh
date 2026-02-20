-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view plans for their tenant" ON public.saas_plans;

-- Create new SELECT policy: platform users see all, tenant members see their plans
CREATE POLICY "Platform users and tenant members can view plans"
ON public.saas_plans FOR SELECT TO authenticated
USING (
  is_active_platform_user(auth.uid())
  OR tenant_id IN (SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid())
  OR tenant_id IS NULL
);

-- Make tenant_id nullable so plans can be global
ALTER TABLE public.saas_plans ALTER COLUMN tenant_id DROP NOT NULL;