
-- Connection logs for TV display security auditing
CREATE TABLE public.display_connection_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_id UUID REFERENCES public.live_displays(id) ON DELETE SET NULL,
  token_id UUID REFERENCES public.live_display_tokens(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'data_fetch',
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by tenant and time
CREATE INDEX idx_display_conn_logs_tenant_time ON public.display_connection_logs(tenant_id, created_at DESC);
CREATE INDEX idx_display_conn_logs_token ON public.display_connection_logs(token_id);

-- Enable RLS
ALTER TABLE public.display_connection_logs ENABLE ROW LEVEL SECURITY;

-- Only platform/tenant admins can read logs (via service role in edge functions)
-- No direct client access needed — logs are written by edge functions with service role
CREATE POLICY "Service role only" ON public.display_connection_logs
  FOR ALL USING (false);

-- Auto-cleanup: partition by time (keep 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_display_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.display_connection_logs
  WHERE created_at < now() - interval '30 days';
$$;
