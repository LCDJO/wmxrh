
-- Drop any duplicate signatures and recreate clean
DROP FUNCTION IF EXISTS public.expire_stale_sessions();
DROP FUNCTION IF EXISTS public.expire_stale_sessions(integer);

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

-- Update the cron job
SELECT cron.unschedule('expire-stale-sessions');
SELECT cron.schedule(
  'expire-stale-sessions',
  '*/2 * * * *',
  $$SELECT public.expire_stale_sessions()$$
);

-- Clean up stale sessions RIGHT NOW
UPDATE public.user_sessions
SET status = 'offline',
    logout_at = now(),
    session_duration = EXTRACT(EPOCH FROM (now() - login_at))::integer
WHERE status IN ('online', 'idle')
  AND last_activity < now() - interval '3 minutes';
