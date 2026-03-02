
-- 1. Add data retention policy tracking
CREATE TABLE IF NOT EXISTS public.worktime_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  retention_years integer NOT NULL DEFAULT 5,
  legal_basis text NOT NULL DEFAULT 'CLT Art. 11 / Portaria 671/2021 Art. 83',
  auto_archive_after_years integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.worktime_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view retention policies"
  ON public.worktime_retention_policies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = worktime_retention_policies.tenant_id
    AND tm.user_id = auth.uid()
  ));

-- 2. Add employee identification fields to ledger for compliance
ALTER TABLE public.worktime_ledger
  ADD COLUMN IF NOT EXISTS employee_name text,
  ADD COLUMN IF NOT EXISTS employee_cpf_masked text,
  ADD COLUMN IF NOT EXISTS employee_pis text;

-- 3. Audit trail table for all worktime actions (append-only)
CREATE TABLE IF NOT EXISTS public.worktime_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  actor_id uuid,
  actor_name text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.worktime_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view audit trail"
  ON public.worktime_audit_trail FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = worktime_audit_trail.tenant_id
    AND tm.user_id = auth.uid()
  ));

-- Immutability: block UPDATE and DELETE on audit trail
CREATE OR REPLACE FUNCTION public.fn_worktime_audit_trail_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'worktime_audit_trail is append-only. Updates and deletes are forbidden.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_worktime_audit_trail_no_update
  BEFORE UPDATE ON public.worktime_audit_trail
  FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_audit_trail_immutable();

CREATE TRIGGER trg_worktime_audit_trail_no_delete
  BEFORE DELETE ON public.worktime_audit_trail
  FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_audit_trail_immutable();

-- 4. Add file_content (generated export text) to worktime_exports
ALTER TABLE public.worktime_exports
  ADD COLUMN IF NOT EXISTS file_content text,
  ADD COLUMN IF NOT EXISTS legal_basis text DEFAULT 'Portaria 671/2021',
  ADD COLUMN IF NOT EXISTS retention_until timestamptz;

-- 5. Index for retention queries
CREATE INDEX IF NOT EXISTS idx_worktime_ledger_tenant_recorded
  ON public.worktime_ledger (tenant_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_worktime_audit_trail_tenant_created
  ON public.worktime_audit_trail (tenant_id, created_at);
