
-- Function to expire stale sessions (no heartbeat for 3+ minutes)
-- Should be called periodically (e.g. by pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.expire_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.user_sessions
  SET
    status = 'offline',
    logout_at = now(),
    session_duration = EXTRACT(EPOCH FROM (now() - login_at))::integer
  WHERE status IN ('online', 'idle')
    AND last_activity < now() - interval '3 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Schedule via pg_cron: run every 2 minutes to clean up stale sessions
SELECT cron.schedule(
  'expire-stale-sessions',
  '*/2 * * * *',
  $$SELECT public.expire_stale_sessions()$$
);
