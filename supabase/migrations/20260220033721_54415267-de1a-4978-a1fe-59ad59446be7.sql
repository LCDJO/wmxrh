
-- Add financial impact field to employee costs
ALTER TABLE public.epi_employee_costs
  ADD COLUMN IF NOT EXISTS impacto_financeiro NUMERIC(12,2) GENERATED ALWAYS AS (custo_total) STORED;

-- Function: Total EPI cost per company for payroll simulation integration
CREATE OR REPLACE FUNCTION public.get_epi_cost_summary_by_company(_tenant_id uuid, _company_id uuid, _period_from date DEFAULT NULL, _period_to date DEFAULT NULL)
RETURNS TABLE(employee_id uuid, employee_name text, total_epi_cost numeric, total_items bigint, centro_custo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.employee_id,
    e.name AS employee_name,
    SUM(ec.custo_total) AS total_epi_cost,
    SUM(ec.quantidade)::bigint AS total_items,
    ec.centro_custo
  FROM public.epi_employee_costs ec
  JOIN public.employees e ON e.id = ec.employee_id
  WHERE ec.tenant_id = _tenant_id
    AND ec.company_id = _company_id
    AND (_period_from IS NULL OR ec.data_apropriacao >= _period_from)
    AND (_period_to IS NULL OR ec.data_apropriacao <= _period_to)
  GROUP BY ec.employee_id, e.name, ec.centro_custo
  ORDER BY total_epi_cost DESC;
END;
$$;
