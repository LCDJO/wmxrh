
-- Drop old enums and table, recreate with new entity schema
DROP TABLE IF EXISTS public.notifications;
DROP TYPE IF EXISTS public.notification_category;
DROP TYPE IF EXISTS public.notification_priority;

-- New notification type enum
CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'critical', 'success');

-- Recreated notifications table matching new entity
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.company_groups(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  source_module TEXT,
  action_url TEXT,
  action_command TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
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
