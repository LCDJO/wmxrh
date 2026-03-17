
-- ═══════════════════════════════════════════════════════════════
-- FIX 1: payment_transactions — Remove anon INSERT, add scoped authenticated
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service role can insert transactions" ON public.payment_transactions;

CREATE POLICY "tenant_member_insert_payment_transactions"
ON public.payment_transactions
FOR INSERT
TO authenticated
WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can view own transactions" ON public.payment_transactions;

CREATE POLICY "tenant_member_select_payment_transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (is_tenant_member(auth.uid(), tenant_id));

-- ═══════════════════════════════════════════════════════════════
-- FIX 2: Governance tables — Replace self-referential policies
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Tenant isolation for org_indicator_configs" ON public.org_indicator_configs;
CREATE POLICY "tenant_member_access_org_indicator_configs"
ON public.org_indicator_configs FOR ALL TO authenticated
USING (is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation for org_indicator_snapshots" ON public.org_indicator_snapshots;
CREATE POLICY "tenant_member_access_org_indicator_snapshots"
ON public.org_indicator_snapshots FOR ALL TO authenticated
USING (is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation for governance_executive_alerts" ON public.governance_executive_alerts;
CREATE POLICY "tenant_member_access_governance_executive_alerts"
ON public.governance_executive_alerts FOR ALL TO authenticated
USING (is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation for governance_alert_configs" ON public.governance_alert_configs;
CREATE POLICY "tenant_member_access_governance_alert_configs"
ON public.governance_alert_configs FOR ALL TO authenticated
USING (is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

-- ═══════════════════════════════════════════════════════════════
-- FIX 3: can_access_employee_data — Remove custom role blanket access
-- Only standard HR roles (superadmin, admin, rh, owner) get access.
-- Custom roles have NO permission system, so they CANNOT grant HR access.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.can_access_employee_data(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    WHERE tm.user_id = p_user_id
      AND tm.tenant_id = p_tenant_id
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.tenant_id = p_tenant_id
      AND ur.role IN ('superadmin', 'admin', 'rh', 'owner')
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- FIX 4: pdf-logos storage — Add tenant-scoped policies
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can upload pdf logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update pdf logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete pdf logos" ON storage.objects;

CREATE POLICY "tenant_upload_pdf_logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pdf-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT tm.tenant_id::text FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "tenant_update_pdf_logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pdf-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT tm.tenant_id::text FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "tenant_delete_pdf_logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pdf-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT tm.tenant_id::text FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);
