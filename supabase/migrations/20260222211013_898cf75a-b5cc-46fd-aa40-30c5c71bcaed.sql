
-- Fix: auto-expire inactive sessions function
CREATE OR REPLACE FUNCTION public.expire_inactive_display_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count1 integer;
  count2 integer;
BEGIN
  UPDATE display_sessions
  SET status = 'disconnected',
      metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{expired_reason}', '"inactivity_timeout"')
  WHERE status = 'active'
    AND last_heartbeat < NOW() - INTERVAL '5 minutes';
  GET DIAGNOSTICS count1 = ROW_COUNT;

  UPDATE display_sessions
  SET status = 'disconnected',
      metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{expired_reason}', '"token_expired"')
  WHERE status = 'active'
    AND expira_em IS NOT NULL
    AND expira_em < NOW();
  GET DIAGNOSTICS count2 = ROW_COUNT;

  UPDATE live_displays
  SET status = 'offline'
  WHERE id IN (
    SELECT display_id FROM display_sessions
    WHERE status = 'disconnected'
      AND metadata->>'expired_reason' IS NOT NULL
  )
  AND status = 'active';

  RETURN count1 + count2;
END;
$$;
