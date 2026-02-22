
-- Create platform_notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'Notificação',
  message TEXT NOT NULL,
  sent_by UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

-- Platform users can read their own notifications
CREATE POLICY "Platform users read own notifications"
  ON public.platform_notifications
  FOR SELECT
  USING (
    user_email = (
      SELECT email FROM public.platform_users
      WHERE user_id = auth.uid() AND status = 'active'
      LIMIT 1
    )
  );

-- Super admins can insert notifications (via edge function with service role, this is a fallback)
CREATE POLICY "Service role can manage notifications"
  ON public.platform_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);
