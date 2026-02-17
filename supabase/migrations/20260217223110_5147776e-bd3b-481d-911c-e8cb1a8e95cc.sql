
-- Chat Sessions
CREATE TABLE public.support_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  assigned_agent_id UUID,
  protocol_number TEXT NOT NULL DEFAULT ('SUP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat Messages
CREATE TABLE public.support_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.support_chat_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('tenant', 'agent', 'system')),
  sender_id UUID,
  message_text TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_chat_sessions_ticket ON public.support_chat_sessions(ticket_id);
CREATE INDEX idx_chat_sessions_tenant ON public.support_chat_sessions(tenant_id);
CREATE INDEX idx_chat_messages_session ON public.support_chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON public.support_chat_messages(session_id, created_at);

-- Updated_at trigger
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.support_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.support_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

-- Tenant members see their own sessions
CREATE POLICY "Tenant members can view own chat sessions"
  ON public.support_chat_sessions FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert chat sessions"
  ON public.support_chat_sessions FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update own chat sessions"
  ON public.support_chat_sessions FOR UPDATE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Platform agents see all sessions
CREATE POLICY "Platform agents can view all chat sessions"
  ON public.support_chat_sessions FOR SELECT TO authenticated
  USING (is_active_platform_user(auth.uid()));

CREATE POLICY "Platform agents can update all chat sessions"
  ON public.support_chat_sessions FOR UPDATE TO authenticated
  USING (is_active_platform_user(auth.uid()));

-- Messages: access via session's tenant
CREATE POLICY "Tenant members can view chat messages"
  ON public.support_chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_chat_sessions s
    WHERE s.id = session_id AND is_tenant_member(auth.uid(), s.tenant_id)
  ));

CREATE POLICY "Tenant members can send chat messages"
  ON public.support_chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_chat_sessions s
    WHERE s.id = session_id AND is_tenant_member(auth.uid(), s.tenant_id)
  ));

CREATE POLICY "Platform agents can view all chat messages"
  ON public.support_chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_chat_sessions s
    WHERE s.id = session_id AND is_active_platform_user(auth.uid())
  ));

CREATE POLICY "Platform agents can send chat messages"
  ON public.support_chat_messages FOR INSERT TO authenticated
  WITH CHECK (is_active_platform_user(auth.uid()));

CREATE POLICY "Platform agents can update chat messages"
  ON public.support_chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_chat_sessions s
    WHERE s.id = session_id AND is_active_platform_user(auth.uid())
  ));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;
