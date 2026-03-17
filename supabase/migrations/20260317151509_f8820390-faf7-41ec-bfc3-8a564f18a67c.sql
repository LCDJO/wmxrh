
-- Remove leftover permissive policies on security_alerts
DROP POLICY IF EXISTS "admins_read_sec_alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "admins_update_sec_alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "system_insert_sec_alerts" ON public.security_alerts;

-- Remove leftover permissive policies on session_risk_analysis
DROP POLICY IF EXISTS "admins_read_risk_analysis" ON public.session_risk_analysis;
DROP POLICY IF EXISTS "system_insert_risk_analysis" ON public.session_risk_analysis;
