/**
 * Post-Termination Labor Risk Report — Preparação Futura
 *
 * Análise de risco trabalhista pós-desligamento.
 * Avalia a probabilidade e impacto financeiro de reclamações
 * trabalhistas com base no histórico do colaborador desligado.
 *
 * Fatores analisados:
 *  1. Tipo de desligamento e verbas pagas
 *  2. Histórico disciplinar e advertências
 *  3. Horas extras não pagas ou banco de horas negativo
 *  4. Desvio de função (CBO × atividade real)
 *  5. Exposição a agentes insalubres/periculosos sem adicional
 *  6. Falhas em documentação (acordos não assinados, ASO vencido)
 *  7. Tempo de empresa e estabilidades não respeitadas
 *  8. Convenção coletiva — cláusulas não cumpridas
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskCategory =
  | 'verbas_rescisorias'
  | 'horas_extras'
  | 'desvio_funcao'
  | 'insalubridade_periculosidade'
  | 'estabilidade'
  | 'documentacao'
  | 'assedio_moral'
  | 'dano_moral'
  | 'acidente_trabalho'
  | 'cct_descumprimento'
  | 'fgts_irregular'
  | 'banco_horas';

export type PrescriptionStatus = 'within_period' | 'partial' | 'prescribed';

export interface PostTerminationRiskFactor {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  evidence: string[];
  financial_exposure_min: number;
  financial_exposure_max: number;
  probability_percentage: number;
  prescription_deadline: string;        // Data limite prescrição
  prescription_status: PrescriptionStatus;
  mitigation_actions: string[];
  legal_basis: string;
}

export interface PostTerminationRiskReport {
  id: string;
  tenant_id: string;
  employee_id: string;
  workflow_id: string | null;
  employee_name: string;
  employee_cpf: string;
  termination_date: string;
  termination_type: string;
  prescription_bienal: string;          // 2 anos após desligamento
  prescription_quinquenal: string;      // 5 anos retroativos
  risk_factors: PostTerminationRiskFactor[];
  total_exposure_min: number;
  total_exposure_max: number;
  overall_risk: RiskSeverity;
  risk_score: number;                   // 0-100
  recommendations: string[];
  generated_at: string;
  generated_by: string | null;
}

export interface RiskReportSummary {
  total_reports: number;
  high_risk_count: number;
  critical_risk_count: number;
  total_financial_exposure: number;
  top_categories: Array<{
    category: RiskCategory;
    count: number;
    total_exposure: number;
  }>;
  upcoming_prescriptions: Array<{
    employee_name: string;
    prescription_date: string;
    days_remaining: number;
  }>;
}

// ═══════════════════════════════════════════════════════
// SERVICE STUB
// ═══════════════════════════════════════════════════════

export const postTerminationRiskService = {
  /**
   * Generate post-termination risk report for an employee.
   * @todo Implement when all data sources (payroll, SST, disciplinary) are integrated.
   */
  async generateReport(
    _tenantId: string,
    _employeeId: string,
    _workflowId: string | null,
  ): Promise<PostTerminationRiskReport> {
    throw new Error('[PostTerminationRisk] Not implemented — awaiting full data integration.');
  },

  /**
   * Get risk report summary for a tenant (dashboard view).
   * @todo Implement when reports are being generated.
   */
  async getSummary(
    _tenantId: string,
    _period?: { from: string; to: string },
  ): Promise<RiskReportSummary> {
    return {
      total_reports: 0,
      high_risk_count: 0,
      critical_risk_count: 0,
      total_financial_exposure: 0,
      top_categories: [],
      upcoming_prescriptions: [],
    };
  },

  /**
   * Calculate prescription dates based on termination date.
   */
  calculatePrescriptionDates(terminationDate: string): {
    bienal: string;
    quinquenal_retroativo: string;
  } {
    const dt = new Date(terminationDate);
    const bienal = new Date(dt);
    bienal.setFullYear(bienal.getFullYear() + 2);
    const quinquenal = new Date(dt);
    quinquenal.setFullYear(quinquenal.getFullYear() - 5);
    return {
      bienal: bienal.toISOString().slice(0, 10),
      quinquenal_retroativo: quinquenal.toISOString().slice(0, 10),
    };
  },

  /**
   * Map risk score to severity level.
   */
  scoreToSeverity(score: number): RiskSeverity {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  },
};
