
-- Block coordinator from financial data (same as other support roles)
CREATE OR REPLACE FUNCTION public.has_platform_financial_read_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id
      AND status = 'active'
      AND role NOT IN ('platform_support', 'platform_support_agent', 'platform_support_manager', 'platform_support_coordinator', 'platform_read_only')
  );
$$;
