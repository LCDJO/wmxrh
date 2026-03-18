-- Add missing RLS policies for tenant signature secrets so tenant admins can manage encrypted credentials safely.

CREATE POLICY "Tenant admins can view signature integration secrets metadata"
ON public.tenant_signature_integration_secrets
FOR SELECT
TO authenticated
USING (public.is_tenant_signature_admin(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins can insert signature integration secrets"
ON public.tenant_signature_integration_secrets
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_signature_admin(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins can update signature integration secrets"
ON public.tenant_signature_integration_secrets
FOR UPDATE
TO authenticated
USING (public.is_tenant_signature_admin(tenant_id, auth.uid()))
WITH CHECK (public.is_tenant_signature_admin(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins can delete signature integration secrets"
ON public.tenant_signature_integration_secrets
FOR DELETE
TO authenticated
USING (public.is_tenant_signature_admin(tenant_id, auth.uid()));