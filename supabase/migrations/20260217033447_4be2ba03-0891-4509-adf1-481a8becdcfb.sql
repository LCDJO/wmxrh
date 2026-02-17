
-- Reliable check: does this tenant need onboarding?
-- Returns FALSE if tenant already has companies OR onboarding is marked completed.
-- SECURITY DEFINER bypasses RLS so the check is always accurate.
CREATE OR REPLACE FUNCTION public.check_tenant_needs_onboarding(p_tenant_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.companies 
    WHERE tenant_id = p_tenant_id AND deleted_at IS NULL
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.onboarding_progress
    WHERE tenant_id = p_tenant_id AND is_completed = true
    LIMIT 1
  );
$$;
