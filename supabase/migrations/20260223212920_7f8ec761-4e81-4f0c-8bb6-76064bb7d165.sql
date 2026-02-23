
-- Rate limiting table for public validation endpoint
CREATE TABLE public.validation_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  attempt_count INT NOT NULL DEFAULT 1,
  failed_count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_vrl_ip ON public.validation_rate_limits(ip_address);
CREATE INDEX idx_vrl_blocked ON public.validation_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- No RLS needed — only accessed by edge function via service role
ALTER TABLE public.validation_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no client access, only service_role can read/write
