
-- ══════════════════════════════════════════════════════════
-- DISPLAY EVENT QUEUE — Server-side event pipeline
-- ══════════════════════════════════════════════════════════

-- Processed display events (tenant-isolated, realtime-enabled)
CREATE TABLE IF NOT EXISTS public.display_event_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_type text NOT NULL DEFAULT 'tracking',
  source text NOT NULL DEFAULT 'platform',
  channel text NOT NULL DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority smallint NOT NULL DEFAULT 2,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

-- Indexes for efficient tenant-scoped reads
CREATE INDEX idx_display_event_queue_tenant_channel 
  ON public.display_event_queue(tenant_id, channel, created_at DESC)
  WHERE NOT processed;

CREATE INDEX idx_display_event_queue_expires 
  ON public.display_event_queue(expires_at)
  WHERE NOT processed;

-- Enable RLS
ALTER TABLE public.display_event_queue ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions insert/read, no direct client access)
CREATE POLICY "Service role full access on display_event_queue"
  ON public.display_event_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for WebSocket broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_event_queue;

-- ══════════════════════════════════════════════════════════
-- DISPLAY SESSIONS — Track active display connections
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.display_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  display_id uuid NOT NULL,
  channel_name text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_display_sessions_tenant 
  ON public.display_sessions(tenant_id, status);

CREATE INDEX idx_display_sessions_channel 
  ON public.display_sessions(channel_name)
  WHERE status = 'active';

ALTER TABLE public.display_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on display_sessions"
  ON public.display_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════
-- AUTO-CLEANUP: Expired events (cron-friendly function)
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_expired_display_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.display_event_queue
  WHERE expires_at < now() OR processed = true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
