
-- Individual EPI Asset Tracking
CREATE TABLE public.epi_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  lot_id UUID REFERENCES public.epi_lots(id),
  serial_number TEXT NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  delivery_id UUID REFERENCES public.epi_deliveries(id),
  status TEXT NOT NULL DEFAULT 'disponivel', -- 'disponivel', 'in_use', 'returned', 'discarded'
  data_entrega DATE,
  data_retorno DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, serial_number)
);

ALTER TABLE public.epi_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view assets"
  ON public.epi_assets FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage assets"
  ON public.epi_assets FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX idx_epi_assets_tenant ON public.epi_assets(tenant_id);
CREATE INDEX idx_epi_assets_employee ON public.epi_assets(employee_id);
CREATE INDEX idx_epi_assets_catalog ON public.epi_assets(epi_catalog_id);
CREATE INDEX idx_epi_assets_serial ON public.epi_assets(serial_number);
CREATE INDEX idx_epi_assets_status ON public.epi_assets(status);

CREATE TRIGGER update_epi_assets_updated_at
  BEFORE UPDATE ON public.epi_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-assign asset to employee on delivery if item is individually trackable
CREATE OR REPLACE FUNCTION public.fn_epi_asset_auto_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rastreavel BOOLEAN;
  _asset_id UUID;
BEGIN
  SELECT rastreavel_individualmente INTO _rastreavel
  FROM public.epi_catalog WHERE id = NEW.epi_catalog_id;

  IF _rastreavel = true THEN
    -- Find available asset with matching catalog
    SELECT id INTO _asset_id
    FROM public.epi_assets
    WHERE tenant_id = NEW.tenant_id
      AND epi_catalog_id = NEW.epi_catalog_id
      AND status = 'disponivel'
      AND (NEW.lot_id IS NULL OR lot_id = NEW.lot_id)
    ORDER BY created_at ASC
    LIMIT 1;

    IF _asset_id IS NOT NULL THEN
      UPDATE public.epi_assets
      SET employee_id = NEW.employee_id,
          delivery_id = NEW.id,
          status = 'in_use',
          data_entrega = CURRENT_DATE
      WHERE id = _asset_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_asset_auto_assign
  AFTER INSERT ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_asset_auto_assign();

-- Auto-return asset on delivery return
CREATE OR REPLACE FUNCTION public.fn_epi_asset_auto_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'devolvido' THEN
    UPDATE public.epi_assets
    SET status = 'returned',
        data_retorno = CURRENT_DATE,
        employee_id = NULL
    WHERE delivery_id = NEW.id AND status = 'in_use';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_asset_auto_return
  AFTER UPDATE ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_asset_auto_return();
