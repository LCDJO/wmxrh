/**
 * Workforce Insight Persistence Service
 *
 * Persists intelligence report results into the workforce_insights table
 * and emits domain events. This is the I/O boundary for insight generation.
 */

import { supabase } from '@/integrations/supabase/client';
import type { WorkforceIntelligenceReport, LaborRisk, WorkforceHealthScore } from './types';
import {
  emitWorkforceEvent,
  type WorkforceInsightCreatedEvent,
  type RiskScoreUpdatedEvent,
} from './workforce-intelligence.events';

interface PersistResult {
  insights_created: number;
  events_emitted: number;
}

/**
 * Persist a full intelligence report's risks as workforce_insights rows
 * and emit domain events for each.
 */
export async function persistInsightsFromReport(
  report: WorkforceIntelligenceReport,
  companyId?: string,
  groupId?: string,
): Promise<PersistResult> {
  const now = new Date().toISOString();
  const risks = report.risk_detection.risks;
  const healthScore = report.health_score;

  // 1. Persist each risk as a workforce_insight row
  const rows = risks.map(risk => ({
    tenant_id: report.tenant_id,
    company_id: companyId ?? null,
    group_id: groupId ?? null,
    insight_type: risk.insight_type,
    severity: mapSeverity(risk.severity),
    descricao: `${risk.title}: ${risk.description}`,
    dados_origem_json: {
      risk_id: risk.risk_id,
      category: risk.category,
      affected_count: risk.affected_count,
      financial_exposure: risk.financial_exposure,
      legal_basis: risk.legal_basis,
      recommended_action: risk.recommended_action,
      affected_employees: risk.affected_employees,
    },
  }));

  let insightsCreated = 0;

  if (rows.length > 0) {
    const { data, error } = await supabase
      .from('workforce_insights')
      .insert(rows)
      .select('id');
    if (error) throw error;

    insightsCreated = data?.length ?? 0;

    // Emit WorkforceInsightCreated events
    for (let i = 0; i < (data?.length ?? 0); i++) {
      const event: WorkforceInsightCreatedEvent = {
        type: 'WorkforceInsightCreated',
        tenant_id: report.tenant_id,
        insight_id: data![i].id,
        insight_type: rows[i].insight_type,
        severity: rows[i].severity,
        description: rows[i].descricao,
        dados_origem_json: rows[i].dados_origem_json as Record<string, unknown>,
        created_at: now,
      };
      emitWorkforceEvent(event);
    }
  }

  // 2. Emit RiskScoreUpdated event
  const riskScoreEvent: RiskScoreUpdatedEvent = {
    type: 'RiskScoreUpdated',
    tenant_id: report.tenant_id,
    previous_score: null, // could be fetched from previous run
    new_score: healthScore.overall_score,
    risk_count: report.risk_detection.total_risks,
    critical_count: report.risk_detection.critical_count,
    financial_exposure: report.risk_detection.total_financial_exposure,
    updated_at: now,
  };
  emitWorkforceEvent(riskScoreEvent);

  return {
    insights_created: insightsCreated,
    events_emitted: insightsCreated + 1, // +1 for RiskScoreUpdated
  };
}

function mapSeverity(riskSeverity: string): 'info' | 'warning' | 'critical' {
  switch (riskSeverity) {
    case 'critical':
    case 'high':
      return 'critical';
    case 'medium':
      return 'warning';
    default:
      return 'info';
  }
}
