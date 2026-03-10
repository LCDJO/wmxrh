
CREATE TABLE public.user_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.user_session_events ENABLE ROW LEVEL SECURITY;

-- Users can read events from their own sessions
CREATE POLICY "Users can read own session events"
  ON public.user_session_events FOR SELECT
  TO authenticated
  USING (
    session_id IN (SELECT id FROM public.user_sessions WHERE user_id = auth.uid())
  );

-- Users can insert events for their own sessions
CREATE POLICY "Users can insert own session events"
  ON public.user_session_events FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (SELECT id FROM public.user_sessions WHERE user_id = auth.uid())
  );

-- Platform admins can read all events
CREATE POLICY "Platform admins can read all session events"
  ON public.user_session_events FOR SELECT
  TO authenticated
  USING (
    public.has_platform_role(auth.uid(), 'platform_super_admin')
    OR public.has_platform_role(auth.uid(), 'platform_support')
  );

-- Indexes
CREATE INDEX idx_session_events_session_id ON public.user_session_events(session_id);
CREATE INDEX idx_session_events_type ON public.user_session_events(event_type);
CREATE INDEX idx_session_events_timestamp ON public.user_session_events(timestamp DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_session_events;
