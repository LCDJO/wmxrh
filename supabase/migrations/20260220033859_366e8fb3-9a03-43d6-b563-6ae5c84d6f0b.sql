
-- EPI Asset Return/Discard tracking
CREATE TABLE public.epi_asset_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  asset_id UUID REFERENCES public.epi_assets(id),
  delivery_id UUID REFERENCES public.epi_deliveries(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  motivo TEXT NOT NULL, -- 'troca', 'desgaste', 'desligamento', 'vencimento'
  condicao TEXT NOT NULL, -- 'reutilizavel', 'danificado', 'vencido'
  data_retorno DATE NOT NULL DEFAULT CURRENT_DATE,
  reintegrado_estoque BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  executor_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_asset_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view returns"
  ON public.epi_asset_returns FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert returns"
  ON public.epi_asset_returns FOR INSERT
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE INDEX idx_epi_asset_returns_tenant ON public.epi_asset_returns(tenant_id);
CREATE INDEX idx_epi_asset_returns_employee ON public.epi_asset_returns(employee_id);
CREATE INDEX idx_epi_asset_returns_asset ON public.epi_asset_returns(asset_id);

-- Trigger: process return — restock if reusable, discard if damaged
CREATE OR REPLACE FUNCTION public.fn_process_epi_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update individual asset status if tracked
  IF NEW.asset_id IS NOT NULL THEN
    UPDATE public.epi_assets
    SET status = CASE WHEN NEW.condicao = 'reutilizavel' THEN 'returned' ELSE 'discarded' END,
        data_retorno = NEW.data_retorno,
        employee_id = NULL
    WHERE id = NEW.asset_id;
  END IF;

  -- If reusable, reintegrate to stock
  IF NEW.condicao = 'reutilizavel' THEN
    -- Find inventory position and add back
    UPDATE public.epi_inventory
    SET quantidade_disponivel = quantidade_disponivel + 1,
        last_movement_at = now()
    WHERE tenant_id = NEW.tenant_id
      AND epi_catalog_id = NEW.epi_catalog_id
      AND id = (
        SELECT i.id FROM public.epi_inventory i
        WHERE i.tenant_id = NEW.tenant_id AND i.epi_catalog_id = NEW.epi_catalog_id
        ORDER BY i.last_movement_at DESC NULLS LAST LIMIT 1
      );

    NEW.reintegrado_estoque := true;

    -- Log movement
    INSERT INTO public.epi_inventory_movements
      (tenant_id, inventory_id, warehouse_id, epi_catalog_id, movement_type, quantidade, reference_type, reference_id, employee_id, justificativa, executor_user_id)
    SELECT NEW.tenant_id, i.id, i.warehouse_id, NEW.epi_catalog_id, 'devolucao', 1, 'return', NEW.id, NEW.employee_id, 'Devolução: ' || NEW.motivo, auth.uid()
    FROM public.epi_inventory i
    WHERE i.tenant_id = NEW.tenant_id AND i.epi_catalog_id = NEW.epi_catalog_id
    ORDER BY i.last_movement_at DESC NULLS LAST LIMIT 1;
  END IF;

  -- If damaged/expired, log as loss
  IF NEW.condicao IN ('danificado', 'vencido') THEN
    INSERT INTO public.epi_inventory_movements
      (tenant_id, inventory_id, warehouse_id, epi_catalog_id, movement_type, quantidade, reference_type, reference_id, employee_id, justificativa, executor_user_id)
    SELECT NEW.tenant_id, i.id, i.warehouse_id, NEW.epi_catalog_id, 'saida_perda', 1, 'return', NEW.id, NEW.employee_id, 'Descarte: ' || NEW.condicao || ' - ' || NEW.motivo, auth.uid()
    FROM public.epi_inventory i
    WHERE i.tenant_id = NEW.tenant_id AND i.epi_catalog_id = NEW.epi_catalog_id
    ORDER BY i.last_movement_at DESC NULLS LAST LIMIT 1;
  END IF;

  -- Audit log
  INSERT INTO public.epi_audit_log (tenant_id, delivery_id, employee_id, action, executor_user_id, details, metadata)
  VALUES (
    NEW.tenant_id, NEW.delivery_id, NEW.employee_id,
    CASE WHEN NEW.condicao = 'reutilizavel' THEN 'devolucao' ELSE 'descarte' END,
    auth.uid(),
    'EPI ' || CASE WHEN NEW.condicao = 'reutilizavel' THEN 'devolvido e reintegrado' ELSE 'descartado (' || NEW.condicao || ')' END || ' - Motivo: ' || NEW.motivo,
    jsonb_build_object('return_id', NEW.id, 'condicao', NEW.condicao, 'motivo', NEW.motivo, 'asset_id', NEW.asset_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_epi_return
  BEFORE INSERT ON public.epi_asset_returns
  FOR EACH ROW EXECUTE FUNCTION public.fn_process_epi_return();
