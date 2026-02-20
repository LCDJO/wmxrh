
-- EPI Incidents table (Loss / Damage tracking)
CREATE TABLE public.epi_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  epi_catalog_id uuid NOT NULL,
  delivery_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('lost', 'damaged')),
  data date NOT NULL DEFAULT CURRENT_DATE,
  justificativa text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'resolvido', 'arquivado')),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  safety_signal_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.epi_incidents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view EPI incidents"
  ON public.epi_incidents FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Employee managers can create EPI incidents"
  ON public.epi_incidents FOR INSERT
  WITH CHECK (public.can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Employee managers can update EPI incidents"
  ON public.epi_incidents FOR UPDATE
  USING (public.can_manage_employees(auth.uid(), tenant_id));

-- Indexes
CREATE INDEX idx_epi_incidents_tenant_status ON public.epi_incidents(tenant_id, status);
CREATE INDEX idx_epi_incidents_employee ON public.epi_incidents(employee_id);

-- Updated_at trigger
CREATE TRIGGER update_epi_incidents_updated_at
  BEFORE UPDATE ON public.epi_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit: log incident to epi_audit_log
CREATE OR REPLACE FUNCTION public.fn_epi_incident_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.epi_audit_log (tenant_id, delivery_id, employee_id, action, executor_user_id, details, metadata)
  VALUES (
    NEW.tenant_id,
    NEW.delivery_id,
    NEW.employee_id,
    CASE NEW.tipo WHEN 'lost' THEN 'extravio' ELSE 'substituicao' END,
    auth.uid(),
    CASE NEW.tipo
      WHEN 'lost' THEN 'EPI registrado como extraviado'
      WHEN 'damaged' THEN 'EPI registrado como danificado'
    END,
    jsonb_build_object(
      'incident_id', NEW.id,
      'tipo', NEW.tipo,
      'justificativa', NEW.justificativa,
      'severity', NEW.severity
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_incident_audit
  AFTER INSERT ON public.epi_incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_incident_audit();

-- Auto-mark delivery as 'extraviado' when incident type is 'lost'
CREATE OR REPLACE FUNCTION public.fn_epi_incident_update_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.delivery_id IS NOT NULL AND NEW.tipo = 'lost' THEN
    UPDATE public.epi_deliveries SET status = 'extraviado' WHERE id = NEW.delivery_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_incident_update_delivery
  AFTER INSERT ON public.epi_incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_incident_update_delivery();
