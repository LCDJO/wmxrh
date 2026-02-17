
-- ══════════════════════════════════════════════════════════════
-- Security: Restrict billing mutations to PlatformSuperAdmin & PlatformFinance
-- Affects: tenant_plans, invoices, platform_financial_entries
-- ══════════════════════════════════════════════════════════════

-- Helper function: check if user is SuperAdmin OR Finance
CREATE OR REPLACE FUNCTION public.is_platform_billing_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id
      AND status = 'active'
      AND role IN ('platform_super_admin', 'platform_finance')
  );
$$;

-- ── tenant_plans: drop overly permissive policies, replace with strict ones ──

DROP POLICY IF EXISTS "Platform admins can insert tenant plans" ON public.tenant_plans;
DROP POLICY IF EXISTS "Platform admins can update tenant plans" ON public.tenant_plans;
DROP POLICY IF EXISTS "Platform admins can delete tenant plans" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_insert" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_update" ON public.tenant_plans;
DROP POLICY IF EXISTS "tenant_plans_delete" ON public.tenant_plans;

CREATE POLICY "billing_admin_insert_tenant_plans"
ON public.tenant_plans FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "billing_admin_update_tenant_plans"
ON public.tenant_plans FOR UPDATE
TO authenticated
USING (public.is_platform_billing_admin(auth.uid()))
WITH CHECK (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "billing_admin_delete_tenant_plans"
ON public.tenant_plans FOR DELETE
TO authenticated
USING (public.is_platform_billing_admin(auth.uid()));

-- ── invoices: replace broad "Platform users full access" with restricted ──

DROP POLICY IF EXISTS "Platform users full access on invoices" ON public.invoices;

CREATE POLICY "billing_admin_manage_invoices"
ON public.invoices FOR ALL
TO authenticated
USING (public.is_platform_billing_admin(auth.uid()))
WITH CHECK (public.is_platform_billing_admin(auth.uid()));

-- Keep tenant read access
-- (already exists: "Tenants can view own invoices")

-- ── platform_financial_entries: same restriction ──

DROP POLICY IF EXISTS "Platform users full access on financial entries" ON public.platform_financial_entries;

CREATE POLICY "billing_admin_manage_financial_entries"
ON public.platform_financial_entries FOR ALL
TO authenticated
USING (public.is_platform_billing_admin(auth.uid()))
WITH CHECK (public.is_platform_billing_admin(auth.uid()));

-- Keep tenant read access
-- (already exists: "Tenants can view own financial entries")
