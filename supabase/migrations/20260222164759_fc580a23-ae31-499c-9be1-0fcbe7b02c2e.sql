
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.platform_notifications;

-- Only allow inserts from authenticated platform admins (edge function uses service role, bypasses RLS)
-- No direct insert/update/delete from client needed for this table
