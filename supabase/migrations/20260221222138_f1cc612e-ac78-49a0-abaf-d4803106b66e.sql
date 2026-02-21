
-- Fleet Device Registry
CREATE TABLE public.fleet_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  device_type TEXT NOT NULL CHECK (device_type IN ('moto', 'carro', 'celular')),
  plate TEXT,
  model TEXT,
  serial_number TEXT NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, serial_number)
);

CREATE INDEX idx_fleet_devices_tenant ON public.fleet_devices(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fleet_devices_employee ON public.fleet_devices(employee_id) WHERE employee_id IS NOT NULL;

ALTER TABLE public.fleet_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read fleet devices"
  ON public.fleet_devices FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Tenant admins can insert fleet devices"
  ON public.fleet_devices FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner', 'admin', 'gestor')
    )
  );

CREATE POLICY "Tenant admins can update fleet devices"
  ON public.fleet_devices FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      JOIN public.user_roles ur ON ur.user_id = tm.user_id AND ur.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND ur.role IN ('owner', 'admin', 'gestor')
    )
  );

CREATE TRIGGER update_fleet_devices_updated_at
  BEFORE UPDATE ON public.fleet_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
