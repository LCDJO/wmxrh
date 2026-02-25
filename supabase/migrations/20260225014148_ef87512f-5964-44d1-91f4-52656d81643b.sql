-- ══════════════════════════════════════════════════════════
-- Behavioral Traffic Intelligence Engine (BTIE) — Schema
-- ══════════════════════════════════════════════════════════

-- 1. Position history (raw GPS data synced from Traccar)
CREATE TABLE public.fleet_position_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  device_id INTEGER NOT NULL,
  device_name TEXT,
  employee_id UUID REFERENCES public.employees(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_knots DOUBLE PRECISION NOT NULL DEFAULT 0,
  speed_kmh DOUBLE PRECISION GENERATED ALWAYS AS (speed_knots * 1.852) STORED,
  course DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  address TEXT,
  ignition BOOLEAN DEFAULT false,
  attributes JSONB DEFAULT '{}',
  fix_time TIMESTAMPTZ NOT NULL,
  server_time TIMESTAMPTZ DEFAULT now(),
  traccar_position_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_pos_hist_tenant_device ON public.fleet_position_history(tenant_id, device_id, fix_time DESC);
CREATE INDEX idx_fleet_pos_hist_fix_time ON public.fleet_position_history(fix_time DESC);
CREATE UNIQUE INDEX idx_fleet_pos_hist_unique ON public.fleet_position_history(tenant_id, device_id, traccar_position_id) WHERE traccar_position_id IS NOT NULL;

ALTER TABLE public.fleet_position_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view position history"
  ON public.fleet_position_history FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "System can insert position history"
  ON public.fleet_position_history FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));


-- 2. Trips (built from sequential positions)
CREATE TABLE public.fleet_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  device_id INTEGER NOT NULL,
  device_name TEXT,
  employee_id UUID REFERENCES public.employees(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER) STORED,
  start_lat DOUBLE PRECISION NOT NULL,
  start_lng DOUBLE PRECISION NOT NULL,
  end_lat DOUBLE PRECISION NOT NULL,
  end_lng DOUBLE PRECISION NOT NULL,
  start_address TEXT,
  end_address TEXT,
  distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_count INTEGER NOT NULL DEFAULT 0,
  violation_count INTEGER NOT NULL DEFAULT 0,
  route_geojson JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_trips_tenant ON public.fleet_trips(tenant_id, device_id, start_time DESC);
CREATE INDEX idx_fleet_trips_employee ON public.fleet_trips(tenant_id, employee_id, start_time DESC);

ALTER TABLE public.fleet_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view trips"
  ON public.fleet_trips FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "System can insert trips"
  ON public.fleet_trips FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));


-- 3. Speed violations (detected infractions)
CREATE TABLE public.fleet_speed_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  device_id INTEGER NOT NULL,
  device_name TEXT,
  employee_id UUID REFERENCES public.employees(id),
  trip_id UUID REFERENCES public.fleet_trips(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_speed_kmh DOUBLE PRECISION NOT NULL,
  speed_limit_kmh DOUBLE PRECISION NOT NULL,
  excess_kmh DOUBLE PRECISION GENERATED ALWAYS AS (recorded_speed_kmh - speed_limit_kmh) STORED,
  violation_type TEXT NOT NULL DEFAULT 'speed_limit',
  source_type TEXT NOT NULL DEFAULT 'zone',
  source_id UUID,
  source_name TEXT,
  radar_point_id UUID,
  zone_id UUID,
  severity TEXT NOT NULL DEFAULT 'medium',
  detected_at TIMESTAMPTZ NOT NULL,
  position_id UUID REFERENCES public.fleet_position_history(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_violations_tenant ON public.fleet_speed_violations(tenant_id, detected_at DESC);
CREATE INDEX idx_fleet_violations_employee ON public.fleet_speed_violations(tenant_id, employee_id, detected_at DESC);
CREATE INDEX idx_fleet_violations_trip ON public.fleet_speed_violations(trip_id);

ALTER TABLE public.fleet_speed_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view violations"
  ON public.fleet_speed_violations FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "System can insert violations"
  ON public.fleet_speed_violations FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));


-- 4. Radar points (dedicated speed camera / radar registry)
CREATE TABLE public.fleet_radar_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_limit_kmh INTEGER NOT NULL,
  detection_radius_meters INTEGER NOT NULL DEFAULT 100,
  direction TEXT,
  road_name TEXT,
  radar_type TEXT NOT NULL DEFAULT 'fixed',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_radar_tenant ON public.fleet_radar_points(tenant_id, is_active);

ALTER TABLE public.fleet_radar_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view radar points"
  ON public.fleet_radar_points FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can manage radar points"
  ON public.fleet_radar_points FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));


-- 5. Driver behavioral scores
CREATE TABLE public.fleet_driver_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  device_id INTEGER,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  speed_score DOUBLE PRECISION NOT NULL DEFAULT 100,
  braking_score DOUBLE PRECISION NOT NULL DEFAULT 100,
  idle_score DOUBLE PRECISION NOT NULL DEFAULT 100,
  compliance_score DOUBLE PRECISION NOT NULL DEFAULT 100,
  overall_score DOUBLE PRECISION NOT NULL DEFAULT 100,
  grade CHAR(1) NOT NULL DEFAULT 'A',
  total_trips INTEGER NOT NULL DEFAULT 0,
  total_distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_duration_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_violations INTEGER NOT NULL DEFAULT 0,
  max_speed_recorded_kmh DOUBLE PRECISION DEFAULT 0,
  avg_speed_kmh DOUBLE PRECISION DEFAULT 0,
  active_warnings INTEGER NOT NULL DEFAULT 0,
  pending_agreements INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_fleet_driver_scores_unique ON public.fleet_driver_scores(tenant_id, employee_id, period_start, period_end);
CREATE INDEX idx_fleet_driver_scores_employee ON public.fleet_driver_scores(tenant_id, employee_id, period_start DESC);

ALTER TABLE public.fleet_driver_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view driver scores"
  ON public.fleet_driver_scores FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "System can manage driver scores"
  ON public.fleet_driver_scores FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));


-- 6. Sync job tracking
CREATE TABLE public.fleet_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  job_type TEXT NOT NULL DEFAULT 'full_sync',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  devices_synced INTEGER DEFAULT 0,
  positions_synced INTEGER DEFAULT 0,
  trips_built INTEGER DEFAULT 0,
  violations_detected INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_sync_jobs_tenant ON public.fleet_sync_jobs(tenant_id, created_at DESC);

ALTER TABLE public.fleet_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view sync jobs"
  ON public.fleet_sync_jobs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "System can manage sync jobs"
  ON public.fleet_sync_jobs FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));
