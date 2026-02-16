
-- Platform cognitive events — non-sensitive behavioral tracking
CREATE TABLE public.platform_cognitive_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'module_use', 'command_exec', 'role_switch')),
  event_key TEXT NOT NULL,          -- e.g. route path, module key, command name
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast aggregation queries
CREATE INDEX idx_cognitive_events_user ON public.platform_cognitive_events (user_id, created_at DESC);
CREATE INDEX idx_cognitive_events_type ON public.platform_cognitive_events (event_type, created_at DESC);

-- Auto-purge events older than 90 days (lightweight retention)
CREATE OR REPLACE FUNCTION public.purge_old_cognitive_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.platform_cognitive_events
  WHERE created_at < now() - interval '90 days';
$$;

-- RLS
ALTER TABLE public.platform_cognitive_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can insert their own events"
ON public.platform_cognitive_events
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND is_active_platform_user(auth.uid())
);

CREATE POLICY "Platform users can read all events"
ON public.platform_cognitive_events
FOR SELECT
USING (is_active_platform_user(auth.uid()));

-- Aggregation RPC for the collector
CREATE OR REPLACE FUNCTION public.get_cognitive_event_stats(days_back INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_active_platform_user(auth.uid()) THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'top_pages', (
      SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
        SELECT event_key AS page, count(*) AS visits
        FROM platform_cognitive_events
        WHERE event_type = 'page_view'
          AND created_at > now() - (days_back || ' days')::interval
        GROUP BY event_key ORDER BY visits DESC LIMIT 15
      ) r
    ),
    'top_modules', (
      SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
        SELECT event_key AS module, count(*) AS uses
        FROM platform_cognitive_events
        WHERE event_type = 'module_use'
          AND created_at > now() - (days_back || ' days')::interval
        GROUP BY event_key ORDER BY uses DESC LIMIT 10
      ) r
    ),
    'top_commands', (
      SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
        SELECT event_key AS command, count(*) AS executions
        FROM platform_cognitive_events
        WHERE event_type = 'command_exec'
          AND created_at > now() - (days_back || ' days')::interval
        GROUP BY event_key ORDER BY executions DESC LIMIT 10
      ) r
    ),
    'role_usage', (
      SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
        SELECT event_key AS role, count(*) AS switches
        FROM platform_cognitive_events
        WHERE event_type = 'role_switch'
          AND created_at > now() - (days_back || ' days')::interval
        GROUP BY event_key ORDER BY switches DESC LIMIT 10
      ) r
    ),
    'active_users', (
      SELECT count(DISTINCT user_id)
      FROM platform_cognitive_events
      WHERE created_at > now() - (days_back || ' days')::interval
    ),
    'total_events', (
      SELECT count(*)
      FROM platform_cognitive_events
      WHERE created_at > now() - (days_back || ' days')::interval
    )
  ) INTO result;

  RETURN result;
END;
$$;
