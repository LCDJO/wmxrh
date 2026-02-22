
-- Fix RLS: restrict to service role only (no anon/authenticated access)
DROP POLICY IF EXISTS "Service role full access on display_event_queue" ON public.display_event_queue;
DROP POLICY IF EXISTS "Service role full access on display_sessions" ON public.display_sessions;

-- These tables are only accessed by edge functions using service_role key
-- Anon/authenticated users should have NO access
CREATE POLICY "No direct client access to display_event_queue"
  ON public.display_event_queue
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client access to display_sessions"
  ON public.display_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);
