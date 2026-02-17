
-- Notification categories enum
CREATE TYPE public.notification_category AS ENUM (
  'compliance', 'security', 'hr', 'payroll', 'system', 'onboarding', 'approval'
);

-- Notification priority enum
CREATE TYPE public.notification_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category notification_category NOT NULL DEFAULT 'system',
  priority notification_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT,
  action_label TEXT,
  action_route TEXT,
  action_metadata JSONB,
  source_module TEXT,
  source_event TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_user_tenant ON public.notifications(user_id, tenant_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, tenant_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications in their tenants"
ON public.notifications FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications for tenant members"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
