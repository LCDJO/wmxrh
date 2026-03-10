
-- Platform admins can read ALL user_sessions across tenants
CREATE POLICY "Platform admins can read all sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_super_admin') OR public.has_platform_role(auth.uid(), 'platform_support'));

-- Enable realtime for user_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
