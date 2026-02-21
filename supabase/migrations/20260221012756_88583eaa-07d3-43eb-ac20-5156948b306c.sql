-- Restrict salary_history: remove 'gestor' from compensation scoped view
-- Create a stricter function for salary history specifically
CREATE OR REPLACE FUNCTION public.can_view_salary_history(_user_id uuid, _tenant_id uuid, _company_id uuid DEFAULT NULL, _company_group_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND (
        -- Only tenant-level compensation roles (no gestor)
        (scope_type = 'tenant' AND role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'rh', 'financeiro'))
        -- Group-level: only group_admin (no gestor)
        OR (scope_type = 'company_group' AND role = 'group_admin' AND scope_id = _company_group_id)
        -- Company-level: only company_admin (no gestor)
        OR (scope_type = 'company' AND role = 'company_admin' AND scope_id = _company_id)
      )
  )
$$;

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Scoped compensation viewers can view salary history" ON public.salary_history;

-- Create stricter policy using the new function
CREATE POLICY "Authorized compensation roles can view salary history"
  ON public.salary_history FOR SELECT
  TO authenticated
  USING (can_view_salary_history(auth.uid(), tenant_id, company_id, company_group_id));
