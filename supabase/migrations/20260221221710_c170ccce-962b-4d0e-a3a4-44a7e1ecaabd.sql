
-- Tighten INSERT policy: only service role (no auth.uid()) can insert
DROP POLICY "Service role can insert tracking events" ON public.raw_tracking_events;

CREATE POLICY "Service role inserts tracking events"
  ON public.raw_tracking_events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );
