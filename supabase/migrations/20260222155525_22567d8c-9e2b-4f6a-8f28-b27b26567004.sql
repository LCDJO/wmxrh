-- Allow platform_super_admin to SELECT all audit_logs (cross-tenant)
CREATE POLICY "Platform superadmin can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_super_admin'));