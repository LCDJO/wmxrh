
-- ═══════════════════════════════════════════════════════════════════
-- EPI INVENTORY & ASSET TRACKING ENGINE
-- Tables: warehouses, inventory, lots, movements, employee cost tracking
-- ═══════════════════════════════════════════════════════════════════

-- 1. Almoxarifados / Locais de Estoque
CREATE TABLE public.epi_warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  responsible_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, code)
);

-- 2. Lotes de EPI (rastreabilidade)
CREATE TABLE public.epi_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  lote_numero TEXT NOT NULL,
  lote_fabricacao DATE,
  lote_validade DATE,
  serial_number TEXT,
  fabricante TEXT,
  nota_fiscal TEXT,
  nota_fiscal_data DATE,
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_recebida INTEGER NOT NULL DEFAULT 0,
  fornecedor TEXT,
  ca_numero TEXT,
  ca_validade DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, epi_catalog_id, lote_numero)
);

-- 3. Estoque por item + almoxarifado + lote
CREATE TABLE public.epi_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.epi_warehouses(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  lot_id UUID REFERENCES public.epi_lots(id),
  quantidade_disponivel INTEGER NOT NULL DEFAULT 0,
  quantidade_reservada INTEGER NOT NULL DEFAULT 0,
  quantidade_minima INTEGER NOT NULL DEFAULT 5,
  custo_unitario_medio NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, warehouse_id, epi_catalog_id, lot_id)
);

-- 4. Movimentações de estoque (audit trail completo)
CREATE TABLE public.epi_inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  inventory_id UUID NOT NULL REFERENCES public.epi_inventory(id),
  warehouse_id UUID NOT NULL REFERENCES public.epi_warehouses(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  lot_id UUID REFERENCES public.epi_lots(id),
  movement_type TEXT NOT NULL, -- 'entrada', 'saida_entrega', 'saida_perda', 'ajuste', 'transferencia', 'devolucao'
  quantidade INTEGER NOT NULL,
  custo_unitario NUMERIC(12,2),
  custo_total NUMERIC(12,2),
  reference_type TEXT, -- 'delivery', 'purchase', 'adjustment', 'transfer', 'return', 'incident'
  reference_id UUID,
  delivery_id UUID REFERENCES public.epi_deliveries(id),
  employee_id UUID REFERENCES public.employees(id),
  nota_fiscal TEXT,
  justificativa TEXT,
  executor_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Custo EPI por colaborador (acumulado)
CREATE TABLE public.epi_employee_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  delivery_id UUID REFERENCES public.epi_deliveries(id),
  lot_id UUID REFERENCES public.epi_lots(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_apropriacao DATE NOT NULL DEFAULT CURRENT_DATE,
  centro_custo TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX idx_epi_warehouses_tenant ON public.epi_warehouses(tenant_id);
CREATE INDEX idx_epi_lots_tenant ON public.epi_lots(tenant_id);
CREATE INDEX idx_epi_lots_catalog ON public.epi_lots(epi_catalog_id);
CREATE INDEX idx_epi_lots_validade ON public.epi_lots(lote_validade);
CREATE INDEX idx_epi_inventory_tenant ON public.epi_inventory(tenant_id);
CREATE INDEX idx_epi_inventory_warehouse ON public.epi_inventory(warehouse_id);
CREATE INDEX idx_epi_inventory_catalog ON public.epi_inventory(epi_catalog_id);
CREATE INDEX idx_epi_movements_tenant ON public.epi_inventory_movements(tenant_id);
CREATE INDEX idx_epi_movements_inventory ON public.epi_inventory_movements(inventory_id);
CREATE INDEX idx_epi_movements_delivery ON public.epi_inventory_movements(delivery_id);
CREATE INDEX idx_epi_movements_employee ON public.epi_inventory_movements(employee_id);
CREATE INDEX idx_epi_movements_created ON public.epi_inventory_movements(created_at);
CREATE INDEX idx_epi_employee_costs_tenant ON public.epi_employee_costs(tenant_id);
CREATE INDEX idx_epi_employee_costs_employee ON public.epi_employee_costs(employee_id);
CREATE INDEX idx_epi_employee_costs_catalog ON public.epi_employee_costs(epi_catalog_id);

-- ═══════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.epi_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_employee_costs ENABLE ROW LEVEL SECURITY;

-- Warehouses
CREATE POLICY "Tenant members can view warehouses"
  ON public.epi_warehouses FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage warehouses"
  ON public.epi_warehouses FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Lots
CREATE POLICY "Tenant members can view lots"
  ON public.epi_lots FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage lots"
  ON public.epi_lots FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Inventory
CREATE POLICY "Tenant members can view inventory"
  ON public.epi_inventory FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage inventory"
  ON public.epi_inventory FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Movements (append-only para membros, view para todos do tenant)
CREATE POLICY "Tenant members can view movements"
  ON public.epi_inventory_movements FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert movements"
  ON public.epi_inventory_movements FOR INSERT
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- Employee Costs
CREATE POLICY "Tenant members can view employee costs"
  ON public.epi_employee_costs FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage employee costs"
  ON public.epi_employee_costs FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGERS: updated_at
-- ═══════════════════════════════════════════════════════════════════

CREATE TRIGGER update_epi_warehouses_updated_at
  BEFORE UPDATE ON public.epi_warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_epi_lots_updated_at
  BEFORE UPDATE ON public.epi_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_epi_inventory_updated_at
  BEFORE UPDATE ON public.epi_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: Baixa automática no estoque ao entregar EPI
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_epi_delivery_stock_deduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv RECORD;
  _custo NUMERIC(12,2) := 0;
BEGIN
  -- Find inventory record for this EPI (prefer matching lot)
  SELECT id, custo_unitario_medio, warehouse_id, lot_id
  INTO _inv
  FROM public.epi_inventory
  WHERE tenant_id = NEW.tenant_id
    AND epi_catalog_id = NEW.epi_catalog_id
    AND quantidade_disponivel >= NEW.quantidade
    AND (NEW.lote IS NULL OR lot_id IN (
      SELECT el.id FROM public.epi_lots el WHERE el.lote_numero = NEW.lote AND el.tenant_id = NEW.tenant_id
    ))
  ORDER BY
    CASE WHEN NEW.lote IS NOT NULL THEN 0 ELSE 1 END,
    quantidade_disponivel DESC
  LIMIT 1;

  IF _inv.id IS NOT NULL THEN
    _custo := COALESCE(_inv.custo_unitario_medio, 0);

    -- Deduct stock
    UPDATE public.epi_inventory
    SET quantidade_disponivel = quantidade_disponivel - NEW.quantidade,
        last_movement_at = now()
    WHERE id = _inv.id;

    -- Log movement
    INSERT INTO public.epi_inventory_movements
      (tenant_id, inventory_id, warehouse_id, epi_catalog_id, lot_id, movement_type, quantidade, custo_unitario, custo_total, reference_type, reference_id, delivery_id, employee_id, executor_user_id)
    VALUES
      (NEW.tenant_id, _inv.id, _inv.warehouse_id, NEW.epi_catalog_id, _inv.lot_id, 'saida_entrega', NEW.quantidade, _custo, _custo * NEW.quantidade, 'delivery', NEW.id, NEW.id, NEW.employee_id, auth.uid());

    -- Track cost per employee
    INSERT INTO public.epi_employee_costs
      (tenant_id, employee_id, company_id, epi_catalog_id, delivery_id, lot_id, quantidade, custo_unitario, custo_total)
    VALUES
      (NEW.tenant_id, NEW.employee_id, NEW.company_id, NEW.epi_catalog_id, NEW.id, _inv.lot_id, NEW.quantidade, _custo, _custo * NEW.quantidade);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_delivery_stock_deduction
  AFTER INSERT ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_delivery_stock_deduction();

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: Devolução reintegra estoque
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_epi_return_stock_reentry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _last_movement RECORD;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'devolvido' THEN
    -- Find the original deduction movement
    SELECT inventory_id, warehouse_id, lot_id, custo_unitario
    INTO _last_movement
    FROM public.epi_inventory_movements
    WHERE delivery_id = NEW.id AND movement_type = 'saida_entrega'
    ORDER BY created_at DESC LIMIT 1;

    IF _last_movement.inventory_id IS NOT NULL THEN
      -- Re-add to stock
      UPDATE public.epi_inventory
      SET quantidade_disponivel = quantidade_disponivel + NEW.quantidade,
          last_movement_at = now()
      WHERE id = _last_movement.inventory_id;

      -- Log return movement
      INSERT INTO public.epi_inventory_movements
        (tenant_id, inventory_id, warehouse_id, epi_catalog_id, lot_id, movement_type, quantidade, custo_unitario, custo_total, reference_type, reference_id, delivery_id, employee_id, executor_user_id)
      VALUES
        (NEW.tenant_id, _last_movement.inventory_id, _last_movement.warehouse_id, NEW.epi_catalog_id, _last_movement.lot_id, 'devolucao', NEW.quantidade, _last_movement.custo_unitario, COALESCE(_last_movement.custo_unitario, 0) * NEW.quantidade, 'return', NEW.id, NEW.id, NEW.employee_id, auth.uid());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_return_stock_reentry
  AFTER UPDATE ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_return_stock_reentry();

-- ═══════════════════════════════════════════════════════════════════
-- FUNCTION: Scan de lotes próximos do vencimento
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.scan_expiring_epi_lots(_tenant_id uuid, _days_ahead integer DEFAULT 30)
RETURNS TABLE(lot_id uuid, epi_nome text, lote_numero text, lote_validade date, dias_restantes integer, quantidade_em_estoque bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS lot_id,
    c.nome AS epi_nome,
    l.lote_numero,
    l.lote_validade,
    (l.lote_validade - CURRENT_DATE)::integer AS dias_restantes,
    COALESCE(SUM(i.quantidade_disponivel), 0)::bigint AS quantidade_em_estoque
  FROM public.epi_lots l
  JOIN public.epi_catalog c ON c.id = l.epi_catalog_id
  LEFT JOIN public.epi_inventory i ON i.lot_id = l.id AND i.tenant_id = l.tenant_id
  WHERE l.tenant_id = _tenant_id
    AND l.lote_validade IS NOT NULL
    AND l.lote_validade <= CURRENT_DATE + (_days_ahead || ' days')::interval
  GROUP BY l.id, c.nome, l.lote_numero, l.lote_validade
  ORDER BY l.lote_validade ASC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- FUNCTION: Custo total de EPI por colaborador
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_epi_cost_by_employee(_tenant_id uuid, _employee_id uuid)
RETURNS TABLE(epi_nome text, total_quantidade bigint, custo_total_acumulado numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.nome AS epi_nome,
    SUM(ec.quantidade)::bigint AS total_quantidade,
    SUM(ec.custo_total) AS custo_total_acumulado
  FROM public.epi_employee_costs ec
  JOIN public.epi_catalog c ON c.id = ec.epi_catalog_id
  WHERE ec.tenant_id = _tenant_id AND ec.employee_id = _employee_id
  GROUP BY c.nome
  ORDER BY custo_total_acumulado DESC;
END;
$$;
