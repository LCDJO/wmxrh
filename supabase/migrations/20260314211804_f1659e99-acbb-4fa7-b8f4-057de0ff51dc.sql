-- Replace expire_stale_sessions to use archive_session with 30-min timeout
CREATE OR REPLACE FUNCTION public.expire_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  affected integer := 0;
BEGIN
  FOR v_session IN
    SELECT id FROM user_sessions
    WHERE status IN ('online', 'idle')
      AND last_activity < now() - interval '30 minutes'
  LOOP
    PERFORM archive_session(v_session.id, 'session_timeout');
    affected := affected + 1;
  END LOOP;
  RETURN affected;
END;
$$;

-- Also update the cron schedule to run every 5 minutes (not every 2)
SELECT cron.alter_job(5, schedule := '*/5 * * * *');