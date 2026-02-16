/**
 * Workforce Intelligence Orchestrator
 *
 * Single entry point that composes all analysis engines to produce
 * a full WorkforceIntelligenceReport. Pure function — no I/O.
 *
 * Consumers:
 *   - Dashboard pages
 *   - Scheduled report generation (future)
 *   - Executive summary exports (future)
 */

import type {
  WorkforceDataset,
  WorkforceIntelligenceReport,
  ProjectionHorizon,
} from './types';
import { projectCosts } from './cost-projection.engine';
import { analyzeSalaries } from './salary-analysis.engine';
import { detectRisks } from './risk-detection.engine';
import { generateInsights } from './insight-generator.engine';

export interface IntelligenceConfig {
  /** Cost projection horizon in months */
  horizon_months?: ProjectionHorizon;
  /** Annual salary adjustment rate (decimal, e.g. 0.05 = 5%) */
  salary_adjustment_rate?: number;
  /** Projected headcount change per month */
  headcount_delta?: number;
  /** Annual benefit cost inflation (decimal) */
  benefit_inflation_rate?: number;
  /** CCT salary floor */
  piso_cct?: number;
  /** Max overtime hours/month */
  max_overtime_hours?: number;
  /** Salary grouping dimension */
  salary_group_by?: 'department' | 'position' | 'company' | 'company_group';
}

const DEFAULTS: Required<IntelligenceConfig> = {
  horizon_months: 12,
  salary_adjustment_rate: 0.05,
  headcount_delta: 0,
  benefit_inflation_rate: 0.04,
  piso_cct: 0,
  max_overtime_hours: 44,
  salary_group_by: 'department',
};

/**
 * Generate a full Workforce Intelligence Report.
 *
 * This is the main orchestrator — call this from UI or scheduled jobs.
 * All sub-engines are pure functions with no side effects.
 */
export function generateIntelligenceReport(
  dataset: WorkforceDataset,
  config?: IntelligenceConfig,
): WorkforceIntelligenceReport {
  const cfg = { ...DEFAULTS, ...config };

  // 1. Cost projection
  const costProjection = projectCosts({
    dataset,
    horizon_months: cfg.horizon_months,
    salary_adjustment_rate: cfg.salary_adjustment_rate,
    headcount_delta: cfg.headcount_delta,
    benefit_inflation_rate: cfg.benefit_inflation_rate,
  });

  // 2. Salary analysis
  const salaryAnalysis = analyzeSalaries({
    dataset,
    group_by: cfg.salary_group_by,
  });

  // 3. Risk detection
  const riskDetection = detectRisks({
    dataset,
    piso_cct: cfg.piso_cct,
    max_overtime_hours: cfg.max_overtime_hours,
  });

  // 4. Insights (synthesizes all above)
  const insights = generateInsights({
    costProjection,
    salaryAnalysis,
    riskDetection,
  });

  return {
    tenant_id: dataset.tenant_id,
    generated_at: new Date().toISOString(),
    period: dataset.analysis_date,
    cost_projection: costProjection,
    salary_analysis: salaryAnalysis,
    risk_detection: riskDetection,
    insights,
    is_intelligence_report: true,
  };
}
