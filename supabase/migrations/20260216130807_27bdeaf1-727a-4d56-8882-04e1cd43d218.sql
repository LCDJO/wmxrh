
-- ================================================
-- SECURITY MIDDLEWARE: Granular RLS Policies
-- Replaces is_tenant_admin with specific role checks
-- Adds scope-based access for group/company admins
-- ================================================

-- 1. Fix tenant INSERT policy (keep allowing creation but ensure user is authenticated)
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. EMPLOYEES: use can_manage_employees for writes
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;

CREATE POLICY "Managers can insert employees"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can update employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (can_manage_employees(auth.uid(), tenant_id))
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can delete employees"
  ON public.employees FOR DELETE TO authenticated
  USING (can_manage_employees(auth.uid(), tenant_id));

-- 3. COMPANIES: tenant_admin+ can manage
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;

CREATE POLICY "Admins can insert companies"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete companies"
  ON public.companies FOR DELETE TO authenticated
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

-- 4. COMPANY GROUPS: tenant_admin+ can manage
DROP POLICY IF EXISTS "Admins can manage company groups" ON public.company_groups;

CREATE POLICY "Admins can insert company groups"
  ON public.company_groups FOR INSERT TO authenticated
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update company groups"
  ON public.company_groups FOR UPDATE TO authenticated
  USING (user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete company groups"
  ON public.company_groups FOR DELETE TO authenticated
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

-- 5. DEPARTMENTS: can_manage_employees role set
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;

CREATE POLICY "Managers can insert departments"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can update departments"
  ON public.departments FOR UPDATE TO authenticated
  USING (can_manage_employees(auth.uid(), tenant_id))
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can delete departments"
  ON public.departments FOR DELETE TO authenticated
  USING (can_manage_employees(auth.uid(), tenant_id));

-- 6. POSITIONS: can_manage_employees role set
DROP POLICY IF EXISTS "Admins can manage positions" ON public.positions;

CREATE POLICY "Managers can insert positions"
  ON public.positions FOR INSERT TO authenticated
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can update positions"
  ON public.positions FOR UPDATE TO authenticated
  USING (can_manage_employees(auth.uid(), tenant_id))
  WITH CHECK (can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Managers can delete positions"
  ON public.positions FOR DELETE TO authenticated
  USING (can_manage_employees(auth.uid(), tenant_id));

-- 7. SALARY CONTRACTS: can_manage_compensation
DROP POLICY IF EXISTS "Admins can insert salary contracts" ON public.salary_contracts;

CREATE POLICY "Compensation managers can insert salary contracts"
  ON public.salary_contracts FOR INSERT TO authenticated
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

CREATE POLICY "Compensation managers can update salary contracts"
  ON public.salary_contracts FOR UPDATE TO authenticated
  USING (can_manage_compensation(auth.uid(), tenant_id))
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

-- 8. SALARY ADJUSTMENTS: can_manage_compensation
DROP POLICY IF EXISTS "Admins can insert salary adjustments" ON public.salary_adjustments;

CREATE POLICY "Compensation managers can insert salary adjustments"
  ON public.salary_adjustments FOR INSERT TO authenticated
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

CREATE POLICY "Compensation managers can update salary adjustments"
  ON public.salary_adjustments FOR UPDATE TO authenticated
  USING (can_manage_compensation(auth.uid(), tenant_id))
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

-- 9. SALARY ADDITIONALS: can_manage_compensation
DROP POLICY IF EXISTS "Admins can insert salary additionals" ON public.salary_additionals;

CREATE POLICY "Compensation managers can insert salary additionals"
  ON public.salary_additionals FOR INSERT TO authenticated
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

CREATE POLICY "Compensation managers can update salary additionals"
  ON public.salary_additionals FOR UPDATE TO authenticated
  USING (can_manage_compensation(auth.uid(), tenant_id))
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

-- 10. SALARY HISTORY: can_manage_compensation for writes, can_view_compensation for reads
DROP POLICY IF EXISTS "Admins can manage salary history" ON public.salary_history;
DROP POLICY IF EXISTS "Members can view salary history" ON public.salary_history;

CREATE POLICY "Compensation viewers can view salary history"
  ON public.salary_history FOR SELECT TO authenticated
  USING (can_view_compensation(auth.uid(), tenant_id));

CREATE POLICY "Compensation managers can insert salary history"
  ON public.salary_history FOR INSERT TO authenticated
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

CREATE POLICY "Compensation managers can update salary history"
  ON public.salary_history FOR UPDATE TO authenticated
  USING (can_manage_compensation(auth.uid(), tenant_id))
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

-- 11. AUDIT LOGS: use can_view_compensation for broader read access, keep trigger-based inserts
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

-- Audit log INSERT is handled by fn_audit_log (SECURITY DEFINER trigger), no user INSERT policy needed

-- 12. EMPLOYEE EVENTS: broader insert access for compensation flow
DROP POLICY IF EXISTS "Admins can insert employee events" ON public.employee_events;

-- Employee events are inserted by SECURITY DEFINER triggers, no user INSERT policy needed
-- Keep SELECT for members
