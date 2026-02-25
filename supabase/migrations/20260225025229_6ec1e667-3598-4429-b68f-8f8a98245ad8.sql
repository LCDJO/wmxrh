
-- Drop the overly broad ALL policy that lacks WITH CHECK
DROP POLICY IF EXISTS "Tenant isolation for hiring_processes" ON public.hiring_processes;

-- SELECT: any tenant member can view
CREATE POLICY "Tenant members can view hiring_processes"
ON public.hiring_processes FOR SELECT
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

-- INSERT: admin/owner/gestor can create
CREATE POLICY "Tenant admins can insert hiring_processes"
ON public.hiring_processes FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    JOIN user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      AND ur.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role, 'gestor'::tenant_role])
  )
);

-- UPDATE: admin/owner/gestor can update
CREATE POLICY "Tenant admins can update hiring_processes"
ON public.hiring_processes FOR UPDATE
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    JOIN user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      AND ur.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role, 'gestor'::tenant_role])
  )
);

-- DELETE: only owner/admin
CREATE POLICY "Tenant admins can delete hiring_processes"
ON public.hiring_processes FOR DELETE
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    JOIN user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      AND ur.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
  )
);
