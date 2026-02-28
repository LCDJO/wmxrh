
-- Fix RLS policy: compare against slug instead of name
DROP POLICY IF EXISTS "Platform superadmins can manage footer defaults" ON public.platform_footer_defaults;

CREATE POLICY "Platform superadmins can manage footer defaults"
ON public.platform_footer_defaults
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM platform_users pu
    JOIN platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid()
      AND pr.slug = 'platform_super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM platform_users pu
    JOIN platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid()
      AND pr.slug = 'platform_super_admin'
  )
);
