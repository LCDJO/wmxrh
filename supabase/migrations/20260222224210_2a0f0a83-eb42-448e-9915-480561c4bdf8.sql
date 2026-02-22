-- Add 'offline' to display_status enum (used by expire_inactive_display_sessions cron)
ALTER TYPE public.display_status ADD VALUE IF NOT EXISTS 'offline';

-- Fix the cron function to use valid enum values
CREATE OR REPLACE FUNCTION public.expire_inactive_display_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count1 integer;
BEGIN
  -- Expire sessions that haven't sent a heartbeat in 5 minutes
  UPDATE display_sessions
  SET status = 'disconnected',
      metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{expired_reason}', '"inactivity_timeout"')
  WHERE status = 'active'
    AND last_heartbeat < NOW() - INTERVAL '5 minutes';
  GET DIAGNOSTICS count1 = ROW_COUNT;

  -- Also expire pending tokens in live_display_tokens that are past expiry
  UPDATE live_display_tokens
  SET status = 'expired'
  WHERE status = 'pending'
    AND expira_em IS NOT NULL
    AND expira_em < NOW();

  -- Mark displays as offline if their session was disconnected due to inactivity
  UPDATE live_displays
  SET status = 'offline'
  WHERE id IN (
    SELECT display_id FROM display_sessions
    WHERE status = 'disconnected'
      AND metadata->>'expired_reason' = 'inactivity_timeout'
  )
  AND status = 'active';

  RETURN count1;
END;
$$;