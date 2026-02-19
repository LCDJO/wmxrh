
-- Update api_clients to match the specified model
-- 1. Make tenant_id optional
ALTER TABLE public.api_clients ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Update client_type constraint
ALTER TABLE public.api_clients DROP CONSTRAINT IF EXISTS api_clients_client_type_check;
ALTER TABLE public.api_clients ADD CONSTRAINT api_clients_client_type_check
  CHECK (client_type IN ('tenant', 'partner', 'internal'));

-- 3. Update default client_type
ALTER TABLE public.api_clients ALTER COLUMN client_type SET DEFAULT 'tenant';

-- 4. Drop the RLS policy and recreate to handle nullable tenant_id
DROP POLICY IF EXISTS "Tenant admins manage api_clients" ON public.api_clients;

-- Tenant admins manage their own clients
CREATE POLICY "Tenant admins manage own api_clients"
  ON public.api_clients FOR ALL
  USING (
    (tenant_id IS NOT NULL AND public.user_is_tenant_admin(auth.uid(), tenant_id))
    OR public.is_active_platform_user(auth.uid())
  )
  WITH CHECK (
    (tenant_id IS NOT NULL AND public.user_is_tenant_admin(auth.uid(), tenant_id))
    OR public.is_active_platform_user(auth.uid())
  );
