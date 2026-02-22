
-- Fix: UPDATE policy needs explicit WITH CHECK that doesn't filter on deleted_at
-- Otherwise PostgreSQL rejects the soft-delete because the new row fails the SELECT policy

DROP POLICY IF EXISTS "Tenant admins can update displays" ON public.live_displays;

CREATE POLICY "Tenant admins can update displays"
ON public.live_displays FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
    AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
    AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
  )
);
