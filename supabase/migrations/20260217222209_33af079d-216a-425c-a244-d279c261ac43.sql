
-- ══════════════════════════════════════════════════════════════
-- SECURITY: Block SupportAgent from financial data
-- ══════════════════════════════════════════════════════════════

-- 1) Helper: platform users WITH financial read access (excludes support roles)
CREATE OR REPLACE FUNCTION public.has_platform_financial_read_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id
      AND status = 'active'
      AND role NOT IN ('platform_support', 'platform_support_agent', 'platform_support_manager', 'platform_read_only')
  );
$$;

-- 2) Replace overly permissive tenant_subscriptions SELECT policy
DROP POLICY IF EXISTS "Platform users can select subscriptions" ON public.tenant_subscriptions;

CREATE POLICY "Platform financial users can select subscriptions"
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (
    -- Tenants see their own subscription
    user_has_tenant_access(auth.uid(), tenant_id)
    -- Platform users with financial access see all
    OR has_platform_financial_read_access(auth.uid())
  );
