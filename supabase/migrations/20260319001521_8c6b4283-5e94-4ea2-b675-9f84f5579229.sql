-- eSocial Integration Engine — secure incremental refactor
-- Extends the existing eSocial event queue without breaking current consumers.

-- 1) Extend existing events table with the new canonical fields
ALTER TABLE public.esocial_events
  ADD COLUMN IF NOT EXISTS payload_json JSONB,
  ADD COLUMN IF NOT EXISTS xml_generated TEXT,
  ADD COLUMN IF NOT EXISTS xml_signed TEXT,
  ADD COLUMN IF NOT EXISTS protocol_number TEXT,
  ADD COLUMN IF NOT EXISTS retries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS government_status_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_id UUID,
  ADD COLUMN IF NOT EXISTS xml_schema_version TEXT NOT NULL DEFAULT 'S-1.2',
  ADD COLUMN IF NOT EXISTS source_provider TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- Backfill compatibility fields from the current schema
UPDATE public.esocial_events
SET payload_json = payload
WHERE payload_json IS NULL;

UPDATE public.esocial_events
SET retries = COALESCE(retry_count, 0)
WHERE retries IS DISTINCT FROM COALESCE(retry_count, 0);

UPDATE public.esocial_events
SET protocol_number = receipt_number
WHERE protocol_number IS NULL
  AND receipt_number IS NOT NULL;

ALTER TABLE public.esocial_events
  ALTER COLUMN payload_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN payload_json SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_esocial_event_compat_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payload_json IS NULL AND NEW.payload IS NOT NULL THEN
    NEW.payload_json := NEW.payload;
  ELSIF NEW.payload IS NULL AND NEW.payload_json IS NOT NULL THEN
    NEW.payload := NEW.payload_json;
  ELSIF NEW.payload_json IS NOT NULL AND NEW.payload IS NOT NULL AND NEW.payload_json <> NEW.payload THEN
    NEW.payload := NEW.payload_json;
  END IF;

  NEW.retries := COALESCE(NEW.retries, NEW.retry_count, 0);
  NEW.retry_count := COALESCE(NEW.retry_count, NEW.retries, 0);

  IF NEW.protocol_number IS NULL AND NEW.receipt_number IS NOT NULL THEN
    NEW.protocol_number := NEW.receipt_number;
  ELSIF NEW.receipt_number IS NULL AND NEW.protocol_number IS NOT NULL THEN
    NEW.receipt_number := NEW.protocol_number;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_esocial_event_compat_fields ON public.esocial_events;
CREATE TRIGGER trg_sync_esocial_event_compat_fields
BEFORE INSERT OR UPDATE ON public.esocial_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_esocial_event_compat_fields();

CREATE INDEX IF NOT EXISTS idx_esocial_events_dispatch_queue
  ON public.esocial_events (tenant_id, status, next_retry_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_esocial_events_protocol_number
  ON public.esocial_events (tenant_id, protocol_number)
  WHERE protocol_number IS NOT NULL;

-- 2) Certificates per tenant/company for XML signing
CREATE TABLE IF NOT EXISTS public.esocial_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id UUID NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_path TEXT NOT NULL,
  certificate_password_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT esocial_certificates_path_not_blank CHECK (btrim(certificate_path) <> ''),
  CONSTRAINT esocial_certificates_password_not_blank CHECK (btrim(certificate_password_encrypted) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_esocial_certificates_active_company
  ON public.esocial_certificates (tenant_id, company_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_esocial_certificates_tenant
  ON public.esocial_certificates (tenant_id, expires_at);

ALTER TABLE public.esocial_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can view esocial certificates" ON public.esocial_certificates;
CREATE POLICY "Tenant admins can view esocial certificates"
ON public.esocial_certificates
FOR SELECT TO authenticated
USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can insert esocial certificates" ON public.esocial_certificates;
CREATE POLICY "Tenant admins can insert esocial certificates"
ON public.esocial_certificates
FOR INSERT TO authenticated
WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can update esocial certificates" ON public.esocial_certificates;
CREATE POLICY "Tenant admins can update esocial certificates"
ON public.esocial_certificates
FOR UPDATE TO authenticated
USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can delete esocial certificates" ON public.esocial_certificates;
CREATE POLICY "Tenant admins can delete esocial certificates"
ON public.esocial_certificates
FOR DELETE TO authenticated
USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

DROP TRIGGER IF EXISTS update_esocial_certificates_updated_at ON public.esocial_certificates;
CREATE TRIGGER update_esocial_certificates_updated_at
BEFORE UPDATE ON public.esocial_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Event logs for auditability and processing trace
CREATE TABLE IF NOT EXISTS public.esocial_event_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.esocial_events(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT esocial_event_logs_action_not_blank CHECK (btrim(action) <> '')
);

CREATE INDEX IF NOT EXISTS idx_esocial_event_logs_event
  ON public.esocial_event_logs (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_esocial_event_logs_tenant
  ON public.esocial_event_logs (tenant_id, created_at DESC);

ALTER TABLE public.esocial_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can view esocial event logs" ON public.esocial_event_logs;
CREATE POLICY "Tenant admins can view esocial event logs"
ON public.esocial_event_logs
FOR SELECT TO authenticated
USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can insert esocial event logs" ON public.esocial_event_logs;
CREATE POLICY "Tenant admins can insert esocial event logs"
ON public.esocial_event_logs
FOR INSERT TO authenticated
WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can update esocial event logs" ON public.esocial_event_logs;
CREATE POLICY "Tenant admins can update esocial event logs"
ON public.esocial_event_logs
FOR UPDATE TO authenticated
USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can delete esocial event logs" ON public.esocial_event_logs;
CREATE POLICY "Tenant admins can delete esocial event logs"
ON public.esocial_event_logs
FOR DELETE TO authenticated
USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- 4) Link events to certificates after table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'esocial_events_certificate_id_fkey'
  ) THEN
    ALTER TABLE public.esocial_events
      ADD CONSTRAINT esocial_events_certificate_id_fkey
      FOREIGN KEY (certificate_id)
      REFERENCES public.esocial_certificates(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 5) Helper function for append-only operational logs
CREATE OR REPLACE FUNCTION public.esocial_append_event_log(
  p_event_id UUID,
  p_tenant_id UUID,
  p_action TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.esocial_event_logs (
    event_id,
    tenant_id,
    action,
    description,
    metadata,
    created_by
  ) VALUES (
    p_event_id,
    p_tenant_id,
    p_action,
    p_description,
    COALESCE(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;