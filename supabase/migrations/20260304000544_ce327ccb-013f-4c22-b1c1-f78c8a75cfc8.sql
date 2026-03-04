-- Drop the existing restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view their tenant plan" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_select" ON public.tenant_plans;

-- Create a single unified SELECT policy that allows:
-- 1. Platform users (super admin / ops) to see ALL tenant plans
-- 2. Tenant members to see their own tenant plan
CREATE POLICY "tenant_plans_select_unified"
ON public.tenant_plans
FOR SELECT
TO authenticated
USING (
  is_active_platform_user(auth.uid())
  OR tenant_id IN (
    SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid()
  )
);