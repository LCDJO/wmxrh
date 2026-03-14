CREATE POLICY "Platform admins can update any session"
ON public.user_sessions
FOR UPDATE
TO authenticated
USING (
  has_platform_role(auth.uid(), 'platform_super_admin'::platform_role)
  OR has_platform_role(auth.uid(), 'platform_support'::platform_role)
)
WITH CHECK (
  has_platform_role(auth.uid(), 'platform_super_admin'::platform_role)
  OR has_platform_role(auth.uid(), 'platform_support'::platform_role)
);