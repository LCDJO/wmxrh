
-- Create security_logs table
CREATE TABLE public.security_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT,
  user_id UUID,
  tenant_id UUID REFERENCES public.tenants(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('allowed', 'blocked')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_security_logs_tenant_created ON public.security_logs (tenant_id, created_at DESC);
CREATE INDEX idx_security_logs_user ON public.security_logs (user_id, created_at DESC);
CREATE INDEX idx_security_logs_result ON public.security_logs (result, created_at DESC);

-- Enable RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Only tenant admins can view
CREATE POLICY "Admins can view security logs"
  ON public.security_logs FOR SELECT
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

-- Block mutations from client
CREATE POLICY "Block security log updates"
  ON public.security_logs FOR UPDATE USING (false);

CREATE POLICY "Block security log deletes"
  ON public.security_logs FOR DELETE USING (false);

-- Allow edge functions (service role) to insert via backend only
-- No INSERT policy for anon/authenticated = client can't insert directly
