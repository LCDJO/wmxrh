
-- Drop broken policies on fleet_disciplinary_rules
DROP POLICY IF EXISTS "Tenant users can view their disciplinary rules" ON public.fleet_disciplinary_rules;
DROP POLICY IF EXISTS "Tenant users can insert disciplinary rules" ON public.fleet_disciplinary_rules;
DROP POLICY IF EXISTS "Tenant users can update their disciplinary rules" ON public.fleet_disciplinary_rules;
DROP POLICY IF EXISTS "Tenant users can delete their disciplinary rules" ON public.fleet_disciplinary_rules;

-- Recreate with correct tenant_memberships pattern
CREATE POLICY "Tenant users can view their disciplinary rules"
ON public.fleet_disciplinary_rules FOR SELECT
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "Tenant users can insert disciplinary rules"
ON public.fleet_disciplinary_rules FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    JOIN user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      AND ur.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role, 'gestor'::tenant_role])
  )
);

CREATE POLICY "Tenant users can update their disciplinary rules"
ON public.fleet_disciplinary_rules FOR UPDATE
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    JOIN user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      AND ur.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role, 'gestor'::tenant_role])
  )
);

CREATE POLICY "Tenant users can delete their disciplinary rules"
ON public.fleet_disciplinary_rules FOR DELETE
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    JOIN user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      AND ur.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
  )
);
