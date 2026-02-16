
-- ================================================
-- SECURITY HARDENING PHASE 2: Scope-Based Access
-- ================================================

-- 1. Create scope-aware compensation viewer function
-- Tenant-level roles see everything, scoped roles see only their scope
CREATE OR REPLACE FUNCTION public.can_view_compensation_scoped(
  _user_id uuid,
  _tenant_id uuid,
  _company_id uuid DEFAULT NULL,
  _company_group_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND (
        -- Tenant-level compensation roles see everything
        (scope_type = 'tenant' AND role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'rh', 'financeiro'))
        -- Group-level roles see their group's data
        OR (scope_type = 'company_group' AND role IN ('group_admin', 'gestor') AND scope_id = _company_group_id)
        -- Company-level roles see their company's data
        OR (scope_type = 'company' AND role IN ('company_admin', 'gestor') AND scope_id = _company_id)
      )
  )
$$;

-- 2. Create scope-aware employee manager function
CREATE OR REPLACE FUNCTION public.can_manage_employees_scoped(
  _user_id uuid,
  _tenant_id uuid,
  _company_id uuid DEFAULT NULL,
  _company_group_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND (
        -- Tenant-level employee managers see everything
        (scope_type = 'tenant' AND role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'rh'))
        -- Group admin sees their group
        OR (scope_type = 'company_group' AND role IN ('group_admin') AND scope_id = _company_group_id)
        -- Company admin sees their company
        OR (scope_type = 'company' AND role IN ('company_admin') AND scope_id = _company_id)
      )
  )
$$;

-- 3. Update compensation SELECT policies to use scoped function
DROP POLICY IF EXISTS "Compensation viewers can view salary contracts" ON public.salary_contracts;
CREATE POLICY "Scoped compensation viewers can view salary contracts"
  ON public.salary_contracts FOR SELECT TO authenticated
  USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));

DROP POLICY IF EXISTS "Compensation viewers can view salary adjustments" ON public.salary_adjustments;
CREATE POLICY "Scoped compensation viewers can view salary adjustments"
  ON public.salary_adjustments FOR SELECT TO authenticated
  USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));

DROP POLICY IF EXISTS "Compensation viewers can view salary additionals" ON public.salary_additionals;
CREATE POLICY "Scoped compensation viewers can view salary additionals"
  ON public.salary_additionals FOR SELECT TO authenticated
  USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));

DROP POLICY IF EXISTS "Compensation viewers can view salary history" ON public.salary_history;
CREATE POLICY "Scoped compensation viewers can view salary history"
  ON public.salary_history FOR SELECT TO authenticated
  USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));

-- 4. Update employee events SELECT to use scoped function
DROP POLICY IF EXISTS "Managers can view employee events" ON public.employee_events;
CREATE POLICY "Scoped managers can view employee events"
  ON public.employee_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_events.employee_id
        AND can_manage_employees_scoped(auth.uid(), employee_events.tenant_id, e.company_id, e.company_group_id)
    )
  );

-- 5. Update employees SELECT to use scope-aware access
DROP POLICY IF EXISTS "Members can view employees" ON public.employees;
CREATE POLICY "Scoped members can view employees"
  ON public.employees FOR SELECT TO authenticated
  USING (
    -- Tenant-level members see all employees in their tenant
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND user_roles.tenant_id = employees.tenant_id
        AND (
          scope_type = 'tenant'
          OR (scope_type = 'company_group' AND scope_id = employees.company_group_id)
          OR (scope_type = 'company' AND scope_id = employees.company_id)
        )
    )
  );

-- 6. Fix tenant_memberships INSERT policy
DROP POLICY IF EXISTS "Users can create first membership" ON public.tenant_memberships;
DROP POLICY IF EXISTS "Admins can insert memberships" ON public.tenant_memberships;
-- Membership creation is handled by auto_add_tenant_owner trigger (SECURITY DEFINER)
-- and should only be done by tenant admins for additional members
CREATE POLICY "Admins can insert memberships"
  ON public.tenant_memberships FOR INSERT TO authenticated
  WITH CHECK (
    -- Either via auto_add_tenant_owner trigger (handled by SECURITY DEFINER)
    -- Or by tenant admins adding new members
    user_is_tenant_admin(auth.uid(), tenant_id)
  );

-- 7. Block manipulation of immutable tables
-- employee_events: INSERT only via SECURITY DEFINER triggers, block UPDATE/DELETE
CREATE POLICY "Block employee event updates"
  ON public.employee_events FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "Block employee event deletes"
  ON public.employee_events FOR DELETE TO authenticated
  USING (false);

-- audit_logs: Block UPDATE/DELETE entirely (immutable)
CREATE POLICY "Block audit log updates"
  ON public.audit_logs FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "Block audit log deletes"
  ON public.audit_logs FOR DELETE TO authenticated
  USING (false);
