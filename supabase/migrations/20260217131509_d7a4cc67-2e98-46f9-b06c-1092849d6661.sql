-- ═══════════════════════════════════════════════════════════════
-- SECURITY: Block tenant users from mutating coupons, pricing, and usage rules
-- Only platform billing admins can manage these resources.
-- ═══════════════════════════════════════════════════════════════

-- 1) saas_plans: Drop tenant-admin mutation policies, replace with platform-only
DROP POLICY IF EXISTS "Admins can insert plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Admins can update plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Admins can delete plans" ON public.saas_plans;

CREATE POLICY "platform_only_insert_plans"
ON public.saas_plans FOR INSERT
TO authenticated
WITH CHECK (is_platform_billing_admin(auth.uid()));

CREATE POLICY "platform_only_update_plans"
ON public.saas_plans FOR UPDATE
TO authenticated
USING (is_platform_billing_admin(auth.uid()));

CREATE POLICY "platform_only_delete_plans"
ON public.saas_plans FOR DELETE
TO authenticated
USING (is_platform_billing_admin(auth.uid()));

-- 2) coupons: Ensure no tenant INSERT/UPDATE/DELETE (platform_billing_admin_coupons already covers mutations)
-- Add explicit deny: tenants can only SELECT active coupons (already exists via anyone_read_active_coupons)
-- No changes needed — mutations already restricted to is_platform_billing_admin

-- 3) coupon_redemptions: Tenants can only SELECT their own, mutations are platform-only
-- Already correct — platform_billing_admin_redemptions + tenant_read_own_redemptions

-- 4) platform_financial_entries: Block tenant INSERT/UPDATE/DELETE
-- Already correct — billing_admin_manage_financial_entries for mutations, tenant SELECT only for reads
