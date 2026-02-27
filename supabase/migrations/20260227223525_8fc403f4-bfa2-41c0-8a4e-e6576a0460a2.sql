
-- SCIM Provisioning Queue — async processing to avoid edge function timeouts
CREATE TABLE public.scim_provisioning_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scim_client_id uuid NOT NULL REFERENCES public.scim_clients(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'PATCH', 'DEACTIVATE', 'REACTIVATE', 'DELETE')),
  resource_type text NOT NULL CHECK (resource_type IN ('User', 'Group')),
  external_id text NOT NULL,
  scim_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scim_provisioning_queue ENABLE ROW LEVEL SECURITY;

-- Service-role only for queue processing; tenant admins can view
CREATE POLICY "Tenant admins view queue"
ON public.scim_provisioning_queue FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = scim_provisioning_queue.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Platform admins view all queue"
ON public.scim_provisioning_queue FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    JOIN public.platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid() AND pr.name IN ('platform_super_admin', 'platform_operations')
  )
);

CREATE INDEX idx_scim_queue_pending ON public.scim_provisioning_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_scim_queue_tenant ON public.scim_provisioning_queue(tenant_id);

CREATE TRIGGER update_scim_queue_updated_at
BEFORE UPDATE ON public.scim_provisioning_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add deactivated_at to scim_provisioned_users for soft-delete tracking
ALTER TABLE public.scim_provisioned_users
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_reason text;

-- Prevent hard deletes on scim_provisioned_users (immutability rule)
CREATE OR REPLACE FUNCTION public.prevent_scim_user_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete not allowed on scim_provisioned_users. Set active=false instead.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_scim_user_delete
BEFORE DELETE ON public.scim_provisioned_users
FOR EACH ROW EXECUTE FUNCTION public.prevent_scim_user_hard_delete();
