
-- Fleet Compliance Policies Tables

-- 1. Speed Zones
CREATE TABLE public.fleet_speed_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  zone_type TEXT NOT NULL DEFAULT 'urban' CHECK (zone_type IN ('urban', 'highway', 'rural', 'school', 'construction', 'custom')),
  speed_limit_kmh INTEGER NOT NULL DEFAULT 60,
  tolerance_kmh INTEGER NOT NULL DEFAULT 7,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 500,
  geojson JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fleet_speed_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their speed zones" ON public.fleet_speed_zones FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can insert speed zones" ON public.fleet_speed_zones FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can update their speed zones" ON public.fleet_speed_zones FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can delete their speed zones" ON public.fleet_speed_zones FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- 2. Enforcement Zones
CREATE TABLE public.fleet_enforcement_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  enforcement_type TEXT NOT NULL DEFAULT 'speed_camera' CHECK (enforcement_type IN ('speed_camera', 'red_light', 'toll', 'weigh_station', 'checkpoint', 'custom')),
  speed_limit_kmh INTEGER,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200,
  alert_distance_meters INTEGER DEFAULT 500,
  direction TEXT,
  road_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fleet_enforcement_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their enforcement zones" ON public.fleet_enforcement_zones FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can insert enforcement zones" ON public.fleet_enforcement_zones FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can update their enforcement zones" ON public.fleet_enforcement_zones FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can delete their enforcement zones" ON public.fleet_enforcement_zones FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- 3. Disciplinary Escalation Rules
CREATE TABLE public.fleet_disciplinary_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  infraction_type TEXT NOT NULL DEFAULT 'speeding' CHECK (infraction_type IN ('speeding', 'harsh_braking', 'harsh_acceleration', 'unauthorized_stop', 'route_deviation', 'geofence_violation', 'fatigue', 'phone_usage', 'custom')),
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  escalation_steps JSONB NOT NULL DEFAULT '[
    {"step":1,"action":"verbal_warning","label":"Advertência Verbal","days_window":30},
    {"step":2,"action":"written_warning","label":"Advertência Escrita","days_window":60},
    {"step":3,"action":"suspension","label":"Suspensão","days_window":90,"suspension_days":3},
    {"step":4,"action":"termination","label":"Desligamento por Justa Causa","days_window":180}
  ]'::jsonb,
  points_per_infraction INTEGER NOT NULL DEFAULT 5,
  auto_generate_task BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fleet_disciplinary_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their disciplinary rules" ON public.fleet_disciplinary_rules FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can insert disciplinary rules" ON public.fleet_disciplinary_rules FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can update their disciplinary rules" ON public.fleet_disciplinary_rules FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can delete their disciplinary rules" ON public.fleet_disciplinary_rules FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_fleet_speed_zones_updated_at
  BEFORE UPDATE ON public.fleet_speed_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fleet_enforcement_zones_updated_at
  BEFORE UPDATE ON public.fleet_enforcement_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fleet_disciplinary_rules_updated_at
  BEFORE UPDATE ON public.fleet_disciplinary_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
