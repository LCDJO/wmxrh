
-- Fix tenants INSERT policy: TO authenticated already ensures user is logged in
-- auth.uid() IS NOT NULL is redundant and may fail in edge cases
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (true);

-- Also fix tenant_memberships: remove duplicate old policy and ensure
-- the auto_add_tenant_owner trigger (SECURITY DEFINER) can always insert
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.tenant_memberships;
