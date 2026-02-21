
-- Add integrity hash to raw_tracking_events
ALTER TABLE public.raw_tracking_events
  ADD COLUMN IF NOT EXISTS integrity_hash TEXT;

-- Fleet audit log (append-only, immutable)
CREATE TABLE public.fleet_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system','user','webhook')),
  old_value JSONB,
  new_value JSONB,
  integrity_hash TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_audit_entity ON public.fleet_audit_log(entity_type, entity_id);
CREATE INDEX idx_fleet_audit_tenant ON public.fleet_audit_log(tenant_id, created_at DESC);

ALTER TABLE public.fleet_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read fleet audit"
  ON public.fleet_audit_log FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Service or auth inserts fleet audit"
  ON public.fleet_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

CREATE POLICY "No updates on fleet audit" ON public.fleet_audit_log FOR UPDATE USING (false);
CREATE POLICY "No deletes on fleet audit" ON public.fleet_audit_log FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION public.prevent_fleet_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'fleet_audit_log is immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_fleet_audit_immutability
  BEFORE UPDATE OR DELETE ON public.fleet_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_fleet_audit_mutation();

-- Auto-hash raw tracking events on insert
CREATE OR REPLACE FUNCTION public.hash_raw_tracking_event()
RETURNS TRIGGER AS $$
BEGIN
  NEW.integrity_hash := encode(
    sha256(
      convert_to(
        NEW.id::text || NEW.device_id || NEW.latitude::text || NEW.longitude::text ||
        NEW.speed::text || COALESCE(NEW.ignition::text, '') || NEW.event_timestamp::text ||
        NEW.tenant_id::text,
        'UTF8'
      )
    ),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_hash_tracking_event
  BEFORE INSERT ON public.raw_tracking_events
  FOR EACH ROW EXECUTE FUNCTION public.hash_raw_tracking_event();
