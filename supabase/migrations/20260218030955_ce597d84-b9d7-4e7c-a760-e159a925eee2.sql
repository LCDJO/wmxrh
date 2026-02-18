
-- ══ Chat Assist Sessions (Coordinator joins a chat) ══
CREATE TYPE public.assist_mode AS ENUM ('silent', 'visible');

CREATE TABLE public.chat_assist_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.support_chat_sessions(id) ON DELETE CASCADE,
  coordinator_id UUID NOT NULL REFERENCES public.platform_users(id),
  assist_mode public.assist_mode NOT NULL DEFAULT 'silent',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active assist per coordinator per session
CREATE UNIQUE INDEX idx_chat_assist_active
  ON public.chat_assist_sessions (session_id, coordinator_id)
  WHERE ended_at IS NULL;

-- RLS
ALTER TABLE public.chat_assist_sessions ENABLE ROW LEVEL SECURITY;

-- Coordinator can view/manage their own assist sessions
CREATE POLICY "Coordinators manage own assists"
  ON public.chat_assist_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.id = chat_assist_sessions.coordinator_id
        AND pu.user_id = auth.uid()
        AND pu.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.id = chat_assist_sessions.coordinator_id
        AND pu.user_id = auth.uid()
        AND pu.status = 'active'
    )
  );

-- Managers and super admins can view all
CREATE POLICY "Managers view all assists"
  ON public.chat_assist_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('platform_super_admin', 'platform_support_manager')
    )
  );

-- Enable realtime for assist sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_assist_sessions;
