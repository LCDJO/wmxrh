-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Tenant members can view training assignments" ON public.nr_training_assignments;

-- 1. RH/Admin: full read access within their tenant
CREATE POLICY "rh_admin_select_nr_trainings"
ON public.nr_training_assignments
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'group_admin', 'company_admin', 'rh')
  )
);

-- 2. Gestor: can view their team (employees in same company via scope)
CREATE POLICY "gestor_select_nr_trainings"
ON public.nr_training_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = nr_training_assignments.tenant_id
      AND ur.role = 'gestor'
      AND (
        -- scope_type = 'company' means gestor manages that company
        (ur.scope_type = 'company' AND ur.scope_id = nr_training_assignments.company_id)
        OR
        -- scope_type = 'company_group' means gestor manages entire group
        (ur.scope_type = 'company_group' AND ur.scope_id = nr_training_assignments.company_group_id)
      )
  )
);

-- 3. Funcionário: can only view their own training records
CREATE POLICY "employee_select_own_nr_trainings"
ON public.nr_training_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = nr_training_assignments.employee_id
      AND e.user_id = auth.uid()
      AND e.tenant_id = nr_training_assignments.tenant_id
  )
);