
-- RPC: PCCS Dashboard Stats (aggregated, bypasses 1000-row limit)

CREATE OR REPLACE FUNCTION public.get_pccs_dashboard_stats(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verify caller has membership
  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    -- Org structure
    'total_positions', (SELECT count(*) FROM career_positions WHERE tenant_id = p_tenant_id AND ativo = true AND deleted_at IS NULL),
    'total_paths', (SELECT count(*) FROM career_paths WHERE tenant_id = p_tenant_id AND ativo = true),
    'total_tracks', (SELECT count(*) FROM career_tracks WHERE tenant_id = p_tenant_id AND ativo = true),
    'total_companies', (SELECT count(*) FROM companies WHERE tenant_id = p_tenant_id AND deleted_at IS NULL AND status = 'active'),
    'total_departments', (SELECT count(*) FROM departments WHERE tenant_id = p_tenant_id AND deleted_at IS NULL),

    -- Positions with risk (have legal mappings requiring exams, EPI, or additionals)
    'positions_with_risk', (
      SELECT count(DISTINCT cp.id)
      FROM career_positions cp
      JOIN career_legal_mappings clm ON clm.career_position_id = cp.id AND clm.tenant_id = p_tenant_id
      WHERE cp.tenant_id = p_tenant_id AND cp.ativo = true AND cp.deleted_at IS NULL
        AND (clm.exige_exame_medico = true OR clm.exige_epi = true OR clm.adicional_aplicavel IS NOT NULL)
    ),

    -- Positions with legal additionals (insalubridade/periculosidade)
    'positions_with_adicional', (
      SELECT count(DISTINCT cp.id)
      FROM career_positions cp
      JOIN career_legal_mappings clm ON clm.career_position_id = cp.id AND clm.tenant_id = p_tenant_id
      WHERE cp.tenant_id = p_tenant_id AND cp.ativo = true AND cp.deleted_at IS NULL
        AND clm.adicional_aplicavel IS NOT NULL
    ),

    -- Positions without CBO
    'positions_without_cbo', (
      SELECT count(*) FROM career_positions
      WHERE tenant_id = p_tenant_id AND ativo = true AND deleted_at IS NULL AND (cbo_codigo IS NULL OR cbo_codigo = '')
    ),

    -- Open risk alerts by severity
    'alerts_by_severity', (
      SELECT COALESCE(json_object_agg(severidade, cnt), '{}')
      FROM (
        SELECT severidade, count(*) as cnt
        FROM career_risk_alerts
        WHERE tenant_id = p_tenant_id AND resolvido = false
        GROUP BY severidade
      ) sub
    ),

    -- Total open alerts
    'total_open_alerts', (SELECT count(*) FROM career_risk_alerts WHERE tenant_id = p_tenant_id AND resolvido = false),

    -- Financial impact: sum of faixa_salarial_min for positions with risk (monthly floor exposure)
    'financial_impact_monthly', (
      SELECT COALESCE(SUM(cp.faixa_salarial_min), 0)
      FROM career_positions cp
      JOIN career_legal_mappings clm ON clm.career_position_id = cp.id AND clm.tenant_id = p_tenant_id
      WHERE cp.tenant_id = p_tenant_id AND cp.ativo = true AND cp.deleted_at IS NULL
        AND clm.adicional_aplicavel IS NOT NULL
    ),

    -- Positions by level
    'positions_by_level', (
      SELECT COALESCE(json_object_agg(nivel, cnt), '{}')
      FROM (
        SELECT nivel, count(*) as cnt
        FROM career_positions
        WHERE tenant_id = p_tenant_id AND ativo = true AND deleted_at IS NULL
        GROUP BY nivel
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$;
