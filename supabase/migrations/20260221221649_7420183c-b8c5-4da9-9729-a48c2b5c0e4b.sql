
-- Raw Tracking Events — append-only, immutable
CREATE TABLE public.raw_tracking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  device_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  ignition BOOLEAN,
  event_timestamp TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for querying
CREATE INDEX idx_raw_tracking_device_ts ON public.raw_tracking_events(device_id, event_timestamp DESC);
CREATE INDEX idx_raw_tracking_tenant ON public.raw_tracking_events(tenant_id, ingested_at DESC);

-- Enable RLS
ALTER TABLE public.raw_tracking_events ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read events from their tenant
CREATE POLICY "Tenant members can read tracking events"
  ON public.raw_tracking_events FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Service role inserts (edge function uses service key)
CREATE POLICY "Service role can insert tracking events"
  ON public.raw_tracking_events FOR INSERT
  WITH CHECK (true);

-- Immutability: prevent UPDATE and DELETE
CREATE POLICY "No updates allowed on tracking events"
  ON public.raw_tracking_events FOR UPDATE
  USING (false);

CREATE POLICY "No deletes allowed on tracking events"
  ON public.raw_tracking_events FOR DELETE
  USING (false);

-- Trigger to enforce immutability at DB level
CREATE OR REPLACE FUNCTION public.prevent_tracking_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'raw_tracking_events is immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_tracking_immutability
  BEFORE UPDATE OR DELETE ON public.raw_tracking_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tracking_event_mutation();
