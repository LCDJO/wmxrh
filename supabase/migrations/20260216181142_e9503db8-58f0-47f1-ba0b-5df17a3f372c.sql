
-- ══════════════════════════════════════════════════════════
-- SECURITY: Tighten RLS for employee_agreements & document_vault
--
-- Rules:
--   1. agreement_templates: only RH/Admin can CUD (already OK)
--   2. employee_agreements: employees see ONLY their own
--   3. document_vault: employees see ONLY their own documents
--   4. Access Graph validated via user_roles
-- ══════════════════════════════════════════════════════════

-- ── Helper: check if user is the employee (via employees.user_id) ──

CREATE OR REPLACE FUNCTION public.user_is_employee(
  _user_id uuid,
  _employee_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = _employee_id
      AND user_id = _user_id
      AND deleted_at IS NULL
  );
$$;

-- ── 1. EMPLOYEE AGREEMENTS — replace broad SELECT with scoped policies ──

-- Drop the overly broad SELECT policy
DROP POLICY IF EXISTS "Users can view employee agreements in their tenant" ON public.employee_agreements;

-- Admins/RH/managers can see all agreements in their tenant
CREATE POLICY "Admins can view all agreements"
  ON public.employee_agreements
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'group_admin', 'company_admin', 'rh', 'gestor', 'manager')
    )
  );

-- Employees can see ONLY their own agreements
CREATE POLICY "Employees can view own agreements"
  ON public.employee_agreements
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_employee(auth.uid(), employee_id)
  );

-- ── 2. DOCUMENT VAULT — replace broad SELECT with scoped policies ──

-- Drop the overly broad SELECT policy
DROP POLICY IF EXISTS "Tenant members can view documents" ON public.document_vault;

-- Admins can view all documents in their tenant
CREATE POLICY "Admins can view all documents"
  ON public.document_vault
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_tenant_admin(auth.uid(), tenant_id)
  );

-- Employees can view ONLY their own documents
CREATE POLICY "Employees can view own documents"
  ON public.document_vault
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_employee(auth.uid(), employee_id)
  );

-- ── 3. AGREEMENT TEMPLATES — verify CUD is admin-only (already correct) ──
-- Templates SELECT is fine for all members (they need to see terms they must sign)
-- CUD restricted to owner/admin via existing "Admins can manage agreement templates" policy ✅
