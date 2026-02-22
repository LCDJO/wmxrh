
-- The SELECT policy filters deleted_at IS NULL, which causes PostgreSQL to reject
-- UPDATE operations that set deleted_at (soft-delete) because the resulting row
-- is no longer visible through the SELECT policy.
-- Fix: Remove deleted_at filter from RLS and handle it in application queries instead.

DROP POLICY IF EXISTS "Tenant members can view displays" ON public.live_displays;

CREATE POLICY "Tenant members can view displays"
ON public.live_displays FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
  )
);
