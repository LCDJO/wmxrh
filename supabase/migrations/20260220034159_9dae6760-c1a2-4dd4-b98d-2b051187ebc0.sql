
-- RPC: Get inventory stock summary for a tenant (optionally filtered by company via warehouse)
CREATE OR REPLACE FUNCTION public.get_epi_inventory_summary(_tenant_id uuid, _warehouse_id uuid DEFAULT NULL)
RETURNS TABLE(
  epi_catalog_id uuid,
  epi_nome text,
  warehouse_id uuid,
  warehouse_name text,
  quantidade_disponivel bigint,
  quantidade_reservada bigint,
  quantidade_minima bigint,
  custo_unitario_medio numeric,
  last_movement_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.epi_catalog_id,
    c.nome AS epi_nome,
    i.warehouse_id,
    w.name AS warehouse_name,
    i.quantidade_disponivel::bigint,
    i.quantidade_reservada::bigint,
    i.quantidade_minima::bigint,
    i.custo_unitario_medio,
    i.last_movement_at
  FROM public.epi_inventory i
  JOIN public.epi_catalog c ON c.id = i.epi_catalog_id
  JOIN public.epi_warehouses w ON w.id = i.warehouse_id
  WHERE i.tenant_id = _tenant_id
    AND (_warehouse_id IS NULL OR i.warehouse_id = _warehouse_id)
  ORDER BY c.nome, w.name;
END;
$$;

-- RPC: Lots grouped by expiry status
CREATE OR REPLACE FUNCTION public.get_epi_lots_by_expiry(_tenant_id uuid)
RETURNS TABLE(
  status text,
  total bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN l.lote_validade IS NULL THEN 'sem_validade'
      WHEN l.lote_validade < CURRENT_DATE THEN 'vencido'
      WHEN l.lote_validade <= CURRENT_DATE + interval '30 days' THEN 'vence_30d'
      WHEN l.lote_validade <= CURRENT_DATE + interval '90 days' THEN 'vence_90d'
      ELSE 'ok'
    END AS status,
    COUNT(*)::bigint AS total
  FROM public.epi_lots l
  WHERE l.tenant_id = _tenant_id
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- RPC: Monthly EPI cost by department
CREATE OR REPLACE FUNCTION public.get_epi_cost_by_department(_tenant_id uuid, _months integer DEFAULT 3)
RETURNS TABLE(
  department_id uuid,
  department_name text,
  mes text,
  custo_total numeric,
  quantidade bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS department_id,
    d.name AS department_name,
    to_char(ec.created_at, 'YYYY-MM') AS mes,
    SUM(ec.custo_total) AS custo_total,
    SUM(ec.quantidade)::bigint AS quantidade
  FROM public.epi_employee_costs ec
  JOIN public.employees e ON e.id = ec.employee_id
  JOIN public.departments d ON d.id = e.department_id
  WHERE ec.tenant_id = _tenant_id
    AND ec.created_at >= (CURRENT_DATE - (_months || ' months')::interval)
  GROUP BY d.id, d.name, to_char(ec.created_at, 'YYYY-MM')
  ORDER BY mes DESC, custo_total DESC;
END;
$$;

-- RPC: EPIs in use per employee (from epi_assets)
CREATE OR REPLACE FUNCTION public.get_epi_assets_in_use(_tenant_id uuid)
RETURNS TABLE(
  employee_id uuid,
  employee_name text,
  epi_nome text,
  serial_number text,
  data_entrega date,
  asset_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.employee_id,
    e.name AS employee_name,
    c.nome AS epi_nome,
    a.serial_number,
    a.data_entrega,
    a.id AS asset_id
  FROM public.epi_assets a
  JOIN public.employees e ON e.id = a.employee_id
  JOIN public.epi_catalog c ON c.id = a.epi_catalog_id
  WHERE a.tenant_id = _tenant_id
    AND a.status = 'in_use'
  ORDER BY e.name, c.nome;
END;
$$;

-- RPC: Company ranking by EPI cost
CREATE OR REPLACE FUNCTION public.get_epi_cost_ranking_by_company(_tenant_id uuid)
RETURNS TABLE(
  company_id uuid,
  company_name text,
  custo_total numeric,
  total_itens bigint,
  total_colaboradores bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    co.id AS company_id,
    co.name AS company_name,
    COALESCE(SUM(ec.custo_total), 0) AS custo_total,
    COALESCE(SUM(ec.quantidade), 0)::bigint AS total_itens,
    COUNT(DISTINCT ec.employee_id)::bigint AS total_colaboradores
  FROM public.companies co
  LEFT JOIN public.epi_employee_costs ec ON ec.company_id = co.id AND ec.tenant_id = _tenant_id
  WHERE co.tenant_id = _tenant_id AND co.status = 'active' AND co.deleted_at IS NULL
  GROUP BY co.id, co.name
  ORDER BY custo_total DESC;
END;
$$;

-- RPC: Stock rupture risk (items close to or below minimum)
CREATE OR REPLACE FUNCTION public.get_epi_stock_rupture_risk(_tenant_id uuid)
RETURNS TABLE(
  inventory_id uuid,
  epi_nome text,
  warehouse_name text,
  quantidade_disponivel bigint,
  quantidade_minima bigint,
  risco text,
  dias_cobertura numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _avg_daily NUMERIC;
BEGIN
  RETURN QUERY
  SELECT
    i.id AS inventory_id,
    c.nome AS epi_nome,
    w.name AS warehouse_name,
    i.quantidade_disponivel::bigint,
    i.quantidade_minima::bigint,
    CASE
      WHEN i.quantidade_disponivel = 0 THEN 'critico'
      WHEN i.quantidade_disponivel <= i.quantidade_minima THEN 'alto'
      WHEN i.quantidade_disponivel <= i.quantidade_minima * 1.5 THEN 'medio'
      ELSE 'baixo'
    END AS risco,
    CASE
      WHEN COALESCE((
        SELECT AVG(m.quantidade)
        FROM public.epi_inventory_movements m
        WHERE m.inventory_id = i.id AND m.movement_type = 'saida_entrega'
          AND m.created_at >= now() - interval '30 days'
      ), 0) = 0 THEN 999
      ELSE ROUND(i.quantidade_disponivel::numeric / GREATEST((
        SELECT AVG(m.quantidade)
        FROM public.epi_inventory_movements m
        WHERE m.inventory_id = i.id AND m.movement_type = 'saida_entrega'
          AND m.created_at >= now() - interval '30 days'
      ), 0.01), 1)
    END AS dias_cobertura
  FROM public.epi_inventory i
  JOIN public.epi_catalog c ON c.id = i.epi_catalog_id
  JOIN public.epi_warehouses w ON w.id = i.warehouse_id
  WHERE i.tenant_id = _tenant_id
    AND i.quantidade_disponivel <= i.quantidade_minima * 1.5
  ORDER BY
    CASE WHEN i.quantidade_disponivel = 0 THEN 0
      WHEN i.quantidade_disponivel <= i.quantidade_minima THEN 1
      ELSE 2 END,
    i.quantidade_disponivel ASC;
END;
$$;
