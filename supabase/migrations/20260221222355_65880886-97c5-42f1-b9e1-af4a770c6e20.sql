
-- Electronic enforcement points (speed cameras / radar)
CREATE TABLE public.fleet_enforcement_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  name TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters DOUBLE PRECISION NOT NULL DEFAULT 50,
  speed_limit_kmh DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_enforcement_tenant ON public.fleet_enforcement_points(tenant_id) WHERE is_active = true;

ALTER TABLE public.fleet_enforcement_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read enforcement points"
  ON public.fleet_enforcement_points FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can insert enforcement points"
  ON public.fleet_enforcement_points FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin','gestor')
  ));

CREATE POLICY "Tenant admins can update enforcement points"
  ON public.fleet_enforcement_points FOR UPDATE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin','gestor')
  ));

CREATE POLICY "Tenant admins can delete enforcement points"
  ON public.fleet_enforcement_points FOR DELETE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner','admin','gestor')
  ));

CREATE TRIGGER update_fleet_enforcement_points_updated_at
  BEFORE UPDATE ON public.fleet_enforcement_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
