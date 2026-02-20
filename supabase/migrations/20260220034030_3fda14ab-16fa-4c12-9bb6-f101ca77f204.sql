
-- Unified EPI alerts table (extends existing epi_stock_alerts concept)
CREATE TABLE public.epi_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  alert_type TEXT NOT NULL, -- 'lot_expiring', 'ca_expiring', 'low_stock', 'no_stock', 'cost_spike'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  entity_type TEXT, -- 'lot', 'catalog', 'inventory', 'department'
  entity_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view alerts"
  ON public.epi_alerts FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update alerts"
  ON public.epi_alerts FOR UPDATE
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE INDEX idx_epi_alerts_tenant_type ON public.epi_alerts(tenant_id, alert_type);
CREATE INDEX idx_epi_alerts_unresolved ON public.epi_alerts(tenant_id) WHERE is_resolved = false;

-- Trigger: auto-generate lot expiring alerts when lots are created/updated
CREATE OR REPLACE FUNCTION public.fn_epi_lot_expiry_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dias INT;
  _epi_nome TEXT;
BEGIN
  IF NEW.lote_validade IS NULL THEN RETURN NEW; END IF;

  _dias := (NEW.lote_validade - CURRENT_DATE);

  SELECT nome INTO _epi_nome FROM public.epi_catalog WHERE id = NEW.epi_catalog_id;

  -- Alert if within 30 days of expiry
  IF _dias <= 30 AND _dias > 0 THEN
    INSERT INTO public.epi_alerts (tenant_id, alert_type, severity, entity_type, entity_id, title, message, metadata)
    SELECT NEW.tenant_id, 'lot_expiring',
      CASE WHEN _dias <= 7 THEN 'critical' ELSE 'warning' END,
      'lot', NEW.id,
      'Lote ' || NEW.lote_numero || ' próximo do vencimento',
      'Lote ' || NEW.lote_numero || ' de ' || COALESCE(_epi_nome, 'EPI') || ' vence em ' || _dias || ' dias',
      jsonb_build_object('dias_restantes', _dias, 'lote_validade', NEW.lote_validade, 'lote_numero', NEW.lote_numero)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.epi_alerts
      WHERE entity_id = NEW.id AND alert_type = 'lot_expiring' AND is_resolved = false
    );
  ELSIF _dias <= 0 THEN
    INSERT INTO public.epi_alerts (tenant_id, alert_type, severity, entity_type, entity_id, title, message, metadata)
    SELECT NEW.tenant_id, 'lot_expiring', 'critical', 'lot', NEW.id,
      'Lote ' || NEW.lote_numero || ' VENCIDO',
      'Lote ' || NEW.lote_numero || ' de ' || COALESCE(_epi_nome, 'EPI') || ' venceu há ' || ABS(_dias) || ' dias',
      jsonb_build_object('dias_restantes', _dias, 'lote_validade', NEW.lote_validade)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.epi_alerts
      WHERE entity_id = NEW.id AND alert_type = 'lot_expiring' AND is_resolved = false
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_lot_expiry_alert
  AFTER INSERT OR UPDATE OF lote_validade ON public.epi_lots
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_lot_expiry_alert();

-- Trigger: CA expiring alert on catalog update
CREATE OR REPLACE FUNCTION public.fn_epi_ca_expiry_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dias INT;
BEGIN
  IF NEW.ca_validade IS NULL THEN RETURN NEW; END IF;

  _dias := (NEW.ca_validade - CURRENT_DATE);

  IF _dias <= 30 THEN
    INSERT INTO public.epi_alerts (tenant_id, alert_type, severity, entity_type, entity_id, title, message, metadata)
    SELECT NEW.tenant_id,
      'ca_expiring',
      CASE WHEN _dias <= 0 THEN 'critical' WHEN _dias <= 7 THEN 'critical' ELSE 'warning' END,
      'catalog', NEW.id,
      CASE WHEN _dias <= 0 THEN 'CA ' || NEW.ca_numero || ' VENCIDO'
        ELSE 'CA ' || NEW.ca_numero || ' vence em ' || _dias || ' dias' END,
      CASE WHEN _dias <= 0 THEN 'CA ' || COALESCE(NEW.ca_numero,'') || ' de ' || NEW.nome || ' venceu há ' || ABS(_dias) || ' dias'
        ELSE 'CA ' || COALESCE(NEW.ca_numero,'') || ' de ' || NEW.nome || ' vence em ' || _dias || ' dias' END,
      jsonb_build_object('ca_numero', NEW.ca_numero, 'ca_validade', NEW.ca_validade, 'dias_restantes', _dias)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.epi_alerts
      WHERE entity_id = NEW.id AND alert_type = 'ca_expiring' AND is_resolved = false
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_ca_expiry_alert
  AFTER INSERT OR UPDATE OF ca_validade ON public.epi_catalog
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_ca_expiry_alert();

-- Trigger: cost spike detection on employee cost insert
CREATE OR REPLACE FUNCTION public.fn_epi_cost_spike_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _avg_cost NUMERIC;
  _dept_name TEXT;
  _dept_id UUID;
BEGIN
  -- Get employee department
  SELECT e.department_id INTO _dept_id
  FROM public.employees e WHERE e.id = NEW.employee_id;

  IF _dept_id IS NULL THEN RETURN NEW; END IF;

  SELECT d.name INTO _dept_name FROM public.departments d WHERE d.id = _dept_id;

  -- Calculate avg cost for this department in last 30 days
  SELECT AVG(ec.custo_total) INTO _avg_cost
  FROM public.epi_employee_costs ec
  JOIN public.employees e ON e.id = ec.employee_id
  WHERE e.department_id = _dept_id
    AND ec.tenant_id = NEW.tenant_id
    AND ec.created_at >= now() - interval '30 days';

  -- Spike if current cost > 2x average
  IF _avg_cost IS NOT NULL AND _avg_cost > 0 AND NEW.custo_total > (_avg_cost * 2) THEN
    INSERT INTO public.epi_alerts (tenant_id, alert_type, severity, entity_type, entity_id, title, message, metadata)
    VALUES (
      NEW.tenant_id, 'cost_spike', 'warning', 'department', _dept_id,
      'Custo elevado de EPI no setor ' || COALESCE(_dept_name, 'N/D'),
      'Custo R$ ' || ROUND(NEW.custo_total, 2) || ' excede 2x a média do setor (R$ ' || ROUND(_avg_cost, 2) || ')',
      jsonb_build_object('custo_atual', NEW.custo_total, 'media_setor', _avg_cost, 'department_id', _dept_id, 'employee_id', NEW.employee_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_cost_spike_alert
  AFTER INSERT ON public.epi_employee_costs
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_cost_spike_alert();

-- Also integrate stock alert trigger into unified alerts table
CREATE OR REPLACE FUNCTION public.fn_epi_unified_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _epi_nome TEXT;
  _wh_name TEXT;
BEGIN
  SELECT nome INTO _epi_nome FROM public.epi_catalog WHERE id = NEW.epi_catalog_id;
  SELECT name INTO _wh_name FROM public.epi_warehouses WHERE id = NEW.warehouse_id;

  IF NEW.quantidade_disponivel <= NEW.quantidade_minima THEN
    INSERT INTO public.epi_alerts (tenant_id, alert_type, severity, entity_type, entity_id, title, message, metadata)
    SELECT NEW.tenant_id,
      CASE WHEN NEW.quantidade_disponivel = 0 THEN 'no_stock' ELSE 'low_stock' END,
      CASE WHEN NEW.quantidade_disponivel = 0 THEN 'critical' ELSE 'warning' END,
      'inventory', NEW.id,
      CASE WHEN NEW.quantidade_disponivel = 0 THEN 'Sem estoque: ' || COALESCE(_epi_nome, 'EPI')
        ELSE 'Estoque baixo: ' || COALESCE(_epi_nome, 'EPI') END,
      CASE WHEN NEW.quantidade_disponivel = 0 THEN 'Sem estoque de ' || COALESCE(_epi_nome, 'EPI') || ' em ' || COALESCE(_wh_name, 'almoxarifado')
        ELSE 'Estoque baixo de ' || COALESCE(_epi_nome, 'EPI') || ' em ' || COALESCE(_wh_name, 'almoxarifado') || ': ' || NEW.quantidade_disponivel || '/' || NEW.quantidade_minima END,
      jsonb_build_object('quantidade_disponivel', NEW.quantidade_disponivel, 'quantidade_minima', NEW.quantidade_minima, 'warehouse_id', NEW.warehouse_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.epi_alerts
      WHERE entity_id = NEW.id AND alert_type IN ('low_stock', 'no_stock') AND is_resolved = false
    );
  ELSE
    -- Auto-resolve when restocked
    UPDATE public.epi_alerts
    SET is_resolved = true, resolved_at = now()
    WHERE entity_id = NEW.id AND alert_type IN ('low_stock', 'no_stock') AND is_resolved = false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_unified_stock_alert
  AFTER INSERT OR UPDATE OF quantidade_disponivel ON public.epi_inventory
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_unified_stock_alert();
