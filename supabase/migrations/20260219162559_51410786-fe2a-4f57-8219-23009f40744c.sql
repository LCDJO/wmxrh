
-- Fix the overly permissive INSERT policy on api_usage_logs
DROP POLICY IF EXISTS "Service insert api_usage_logs" ON public.api_usage_logs;

-- Only allow inserts from tenant admins or through service role (edge functions)
CREATE POLICY "Tenant context insert api_usage_logs"
  ON public.api_usage_logs FOR INSERT
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));
