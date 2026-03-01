-- Allow platform admins to UPDATE policy versions (needed for marking is_current = false)
CREATE POLICY "Platform admins can update versions"
ON public.platform_policy_versions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_users pu
    JOIN platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid()
      AND pu.status = 'active'
      AND pr.slug IN ('platform_super_admin', 'platform_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM platform_users pu
    JOIN platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid()
      AND pu.status = 'active'
      AND pr.slug IN ('platform_super_admin', 'platform_admin')
  )
);