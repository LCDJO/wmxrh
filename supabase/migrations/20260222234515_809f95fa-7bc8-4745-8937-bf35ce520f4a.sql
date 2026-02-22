
-- Telegram Bot Configurations per tenant
CREATE TABLE public.telegram_bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bot_token_encrypted TEXT,
  bot_username TEXT,
  webhook_secret TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN DEFAULT false,
  connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error')),
  last_verified_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id)
);

ALTER TABLE public.telegram_bot_configs ENABLE ROW LEVEL SECURITY;

-- Telegram Message Queue
CREATE TABLE public.telegram_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  parse_mode TEXT DEFAULT 'HTML',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.telegram_message_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_telegram_queue_status ON public.telegram_message_queue(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_telegram_queue_tenant ON public.telegram_message_queue(tenant_id);

-- Telegram Webhook Logs
CREATE TABLE public.telegram_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  update_id BIGINT,
  chat_id TEXT,
  from_username TEXT,
  command TEXT,
  message_text TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  response_sent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.telegram_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_telegram_webhook_tenant ON public.telegram_webhook_logs(tenant_id, created_at DESC);

-- RLS Policies
CREATE POLICY "Tenant members can view bot config"
ON public.telegram_bot_configs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_bot_configs.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
));

CREATE POLICY "Tenant admins can manage bot config"
ON public.telegram_bot_configs FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_bot_configs.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
  AND tm.role IN ('admin', 'owner')
));

CREATE POLICY "Tenant members can view message queue"
ON public.telegram_message_queue FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_message_queue.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
));

CREATE POLICY "Tenant members can insert messages"
ON public.telegram_message_queue FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_message_queue.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
));

CREATE POLICY "Tenant members can view webhook logs"
ON public.telegram_webhook_logs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_webhook_logs.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
));

-- Service role policies for edge functions
CREATE POLICY "Service role full access bot configs"
ON public.telegram_bot_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access message queue"
ON public.telegram_message_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access webhook logs"
ON public.telegram_webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_telegram_bot_configs_updated_at
BEFORE UPDATE ON public.telegram_bot_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
