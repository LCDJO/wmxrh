
-- ══════════════════════════════════════════════════════════
-- Traccar Integration Refactoring — Schema Updates
-- ══════════════════════════════════════════════════════════

-- 1. Add missing columns to raw_tracking_events for richer telemetry
ALTER TABLE public.raw_tracking_events 
  ADD COLUMN IF NOT EXISTS course double precision,
  ADD COLUMN IF NOT EXISTS altitude double precision,
  ADD COLUMN IF NOT EXISTS satellites integer,
  ADD COLUMN IF NOT EXISTS battery_level double precision,
  ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'webhook',
  ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_raw_tracking_events_unprocessed 
  ON public.raw_tracking_events (tenant_id, processed, ingested_at) 
  WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_raw_tracking_events_device_time 
  ON public.raw_tracking_events (tenant_id, device_id, event_timestamp DESC);

-- 2. Traccar sync status
CREATE TABLE IF NOT EXISTS public.traccar_sync_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sync_type text NOT NULL DEFAULT 'positions',
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  last_device_count integer DEFAULT 0,
  last_position_count integer DEFAULT 0,
  last_error text,
  consecutive_failures integer DEFAULT 0,
  is_healthy boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sync_type)
);

ALTER TABLE public.traccar_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their sync status"
  ON public.traccar_sync_status FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

-- 3. Traccar device cache
CREATE TABLE IF NOT EXISTS public.traccar_device_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  traccar_id integer NOT NULL,
  unique_id text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'unknown',
  disabled boolean DEFAULT false,
  last_update timestamptz,
  position_id integer,
  group_id integer,
  phone text,
  model text,
  category text,
  attributes jsonb DEFAULT '{}',
  employee_id uuid,
  vehicle_id uuid,
  fleet_device_id uuid,
  latitude double precision,
  longitude double precision,
  speed double precision DEFAULT 0,
  course double precision,
  altitude double precision,
  ignition boolean,
  address text,
  position_time timestamptz,
  computed_status text DEFAULT 'unknown',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, traccar_id)
);

ALTER TABLE public.traccar_device_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their device cache"
  ON public.traccar_device_cache FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_traccar_device_cache_tenant 
  ON public.traccar_device_cache (tenant_id, computed_status);

CREATE TRIGGER update_traccar_sync_status_updated_at
  BEFORE UPDATE ON public.traccar_sync_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_traccar_device_cache_updated_at
  BEFORE UPDATE ON public.traccar_device_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
