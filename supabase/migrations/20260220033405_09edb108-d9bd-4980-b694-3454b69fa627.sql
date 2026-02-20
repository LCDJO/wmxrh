
-- Add local_estoque to epi_inventory
ALTER TABLE public.epi_inventory
  ADD COLUMN IF NOT EXISTS local_estoque TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: Block delivery if insufficient stock
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_block_delivery_insufficient_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _available INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantidade_disponivel), 0) INTO _available
  FROM public.epi_inventory
  WHERE tenant_id = NEW.tenant_id
    AND epi_catalog_id = NEW.epi_catalog_id
    AND quantidade_disponivel > 0;

  IF _available < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para entrega. Disponível: %, Solicitado: %', _available, NEW.quantidade;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_delivery_insufficient_stock
  BEFORE INSERT ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_delivery_insufficient_stock();

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: Stock alerts (persistent)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.epi_stock_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  inventory_id UUID NOT NULL REFERENCES public.epi_inventory(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  warehouse_id UUID NOT NULL REFERENCES public.epi_warehouses(id),
  alert_type TEXT NOT NULL DEFAULT 'low_stock', -- 'low_stock', 'no_stock'
  quantidade_disponivel INTEGER NOT NULL,
  quantidade_minima INTEGER NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view stock alerts"
  ON public.epi_stock_alerts FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage stock alerts"
  ON public.epi_stock_alerts FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX idx_epi_stock_alerts_tenant ON public.epi_stock_alerts(tenant_id);
CREATE INDEX idx_epi_stock_alerts_unresolved ON public.epi_stock_alerts(tenant_id, is_resolved) WHERE is_resolved = false;

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: Auto-generate stock alert when qty < minimum
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_epi_stock_alert_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.quantidade_disponivel <= NEW.quantidade_minima THEN
    -- Create alert if none unresolved exists for this inventory
    INSERT INTO public.epi_stock_alerts
      (tenant_id, inventory_id, epi_catalog_id, warehouse_id, alert_type, quantidade_disponivel, quantidade_minima)
    SELECT
      NEW.tenant_id, NEW.id, NEW.epi_catalog_id, NEW.warehouse_id,
      CASE WHEN NEW.quantidade_disponivel = 0 THEN 'no_stock' ELSE 'low_stock' END,
      NEW.quantidade_disponivel, NEW.quantidade_minima
    WHERE NOT EXISTS (
      SELECT 1 FROM public.epi_stock_alerts
      WHERE inventory_id = NEW.id AND is_resolved = false
    );
  ELSE
    -- Auto-resolve alerts when stock replenished
    UPDATE public.epi_stock_alerts
    SET is_resolved = true, resolved_at = now()
    WHERE inventory_id = NEW.id AND is_resolved = false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_stock_alert_check
  AFTER INSERT OR UPDATE OF quantidade_disponivel ON public.epi_inventory
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_stock_alert_check();
