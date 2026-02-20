
-- ═══ EPI Requirements Table ═══
CREATE TABLE public.epi_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  epi_catalog_id uuid NOT NULL REFERENCES public.epi_catalog(id),
  risk_exposure_id uuid REFERENCES public.employee_risk_exposures(id),
  motivo text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pendente', -- pendente, atendido, dispensado
  atendido_em timestamptz,
  atendido_por uuid,
  delivery_id uuid REFERENCES public.epi_deliveries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_epi_requirements_tenant ON public.epi_requirements(tenant_id);
CREATE INDEX idx_epi_requirements_employee ON public.epi_requirements(employee_id);
CREATE INDEX idx_epi_requirements_status ON public.epi_requirements(tenant_id, status);
CREATE UNIQUE INDEX idx_epi_requirements_unique_active ON public.epi_requirements(employee_id, epi_catalog_id, risk_exposure_id) WHERE status = 'pendente';

-- RLS
ALTER TABLE public.epi_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view epi_requirements"
  ON public.epi_requirements FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Employee managers can insert epi_requirements"
  ON public.epi_requirements FOR INSERT
  WITH CHECK (public.can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Employee managers can update epi_requirements"
  ON public.epi_requirements FOR UPDATE
  USING (public.can_manage_employees(auth.uid(), tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_epi_requirements_updated_at
  BEFORE UPDATE ON public.epi_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ Auto-generate EPI requirements when a risk exposure is created/activated ═══
CREATE OR REPLACE FUNCTION public.fn_auto_create_epi_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mapping RECORD;
  _risk_agent_name text;
BEGIN
  -- Only process active exposures that require EPI
  IF NEW.is_active = false OR NEW.requires_epi = false THEN
    RETURN NEW;
  END IF;

  -- Get risk agent name from the risk factor
  SELECT name INTO _risk_agent_name
  FROM public.occupational_risk_factors
  WHERE id = NEW.risk_factor_id;

  IF _risk_agent_name IS NULL THEN
    _risk_agent_name := COALESCE(NEW.epi_description, 'Risco não identificado');
  END IF;

  -- Find all mandatory EPI mappings for this risk agent
  FOR _mapping IN
    SELECT erm.epi_catalog_id, ec.nome AS epi_nome, erm.risk_agent
    FROM public.epi_risk_mappings erm
    JOIN public.epi_catalog ec ON ec.id = erm.epi_catalog_id AND ec.is_active = true
    WHERE erm.tenant_id = NEW.tenant_id
      AND erm.obrigatorio = true
      AND (
        erm.risk_agent = _risk_agent_name
        OR erm.risk_agent = ANY(
          SELECT unnest(risco_relacionado) FROM public.epi_catalog WHERE id = erm.epi_catalog_id
        )
      )
  LOOP
    -- Insert requirement (unique index prevents duplicates for same active exposure)
    INSERT INTO public.epi_requirements (tenant_id, employee_id, epi_catalog_id, risk_exposure_id, motivo, obrigatorio)
    VALUES (
      NEW.tenant_id,
      NEW.employee_id,
      _mapping.epi_catalog_id,
      NEW.id,
      'Exposição a ' || _mapping.risk_agent || ' exige ' || _mapping.epi_nome,
      true
    )
    ON CONFLICT (employee_id, epi_catalog_id, risk_exposure_id) WHERE status = 'pendente'
    DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_epi_requirements ON public.employee_risk_exposures;
CREATE TRIGGER trg_auto_epi_requirements
  AFTER INSERT OR UPDATE ON public.employee_risk_exposures
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_create_epi_requirements();

-- ═══ Auto-fulfill requirement when EPI is delivered ═══
CREATE OR REPLACE FUNCTION public.fn_auto_fulfill_epi_requirement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.epi_requirements
  SET status = 'atendido',
      atendido_em = now(),
      atendido_por = auth.uid(),
      delivery_id = NEW.id
  WHERE employee_id = NEW.employee_id
    AND epi_catalog_id = NEW.epi_catalog_id
    AND status = 'pendente'
    AND tenant_id = NEW.tenant_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fulfill_epi_requirement ON public.epi_deliveries;
CREATE TRIGGER trg_auto_fulfill_epi_requirement
  AFTER INSERT ON public.epi_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_fulfill_epi_requirement();
