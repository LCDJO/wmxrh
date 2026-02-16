/**
 * Workforce Health Score Engine
 *
 * Computes a composite 0–100 indicator from four sub-scores:
 *   1. compliance_score   — PCMSO, PGR, violations (40% weight)
 *   2. custo_score        — cost projection stability (20% weight)
 *   3. risco_trabalhista_score — risk detection severity (25% weight)
 *   4. estabilidade_forca_trabalho — tenure & turnover proxy (15% weight)
 *
 * Each sub-score is 0–100 (higher = healthier).
 * Pure function — no I/O.
 */

import type {
  HealthScoreInput,
  WorkforceHealthScore,
} from './types';

const WEIGHTS = {
  compliance: 0.40,
  custo: 0.20,
  risco: 0.25,
  estabilidade: 0.15,
};

export function computeHealthScore(input: HealthScoreInput): WorkforceHealthScore {
  const { dataset, riskDetection, costProjection, salaryAnalysis } = input;

  const compliance_score = calcComplianceScore(dataset);
  const custo_score = calcCustoScore(costProjection);
  const risco_trabalhista_score = calcRiscoScore(riskDetection);
  const estabilidade_forca_trabalho = calcEstabilidadeScore(dataset);

  const overall_score = clamp(Math.round(
    compliance_score * WEIGHTS.compliance +
    custo_score * WEIGHTS.custo +
    risco_trabalhista_score * WEIGHTS.risco +
    estabilidade_forca_trabalho * WEIGHTS.estabilidade
  ));

  return {
    overall_score,
    compliance_score,
    custo_score,
    risco_trabalhista_score,
    estabilidade_forca_trabalho,
    classification: classify(overall_score),
    breakdown: {
      compliance_weight: WEIGHTS.compliance,
      custo_weight: WEIGHTS.custo,
      risco_weight: WEIGHTS.risco,
      estabilidade_weight: WEIGHTS.estabilidade,
      active_employees: dataset.employees.filter(e => e.status === 'active').length,
      total_risks: riskDetection.total_risks,
      risk_score_raw: riskDetection.risk_score,
      equity_alerts: salaryAnalysis.equity_alerts.length,
    },
  };
}

// ── Sub-score calculators ──

function calcComplianceScore(dataset: import('./types').WorkforceDataset): number {
  const comp = dataset.compliance;
  if (comp.length === 0) return 100;

  let penalties = 0;

  // Overdue exams: -15 per employee (max -60)
  const overdueCount = comp.filter(c => c.exam_overdue).length;
  penalties += Math.min(60, overdueCount * 15);

  // No PGR: -20 per unique case
  const noPGR = comp.filter(c => c.has_active_pgr === false).length;
  penalties += Math.min(30, noPGR * 20);

  // Open violations: -5 per violation, -15 per critical
  for (const c of comp) {
    if (c.open_violations > 0) {
      const criticals = c.violation_severities.filter(s => s === 'critical').length;
      penalties += criticals * 15 + (c.open_violations - criticals) * 5;
    }
  }

  // Risk exposure without hazard pay
  const missingHazard = comp.filter(c => c.has_risk_exposure && !c.has_hazard_pay).length;
  penalties += missingHazard * 10;

  return clamp(100 - penalties);
}

function calcCustoScore(costProjection: import('./types').CostProjectionOutput): number {
  // Based on projected delta: low delta = high score
  if (costProjection.monthly_projections.length === 0) return 100;

  const last = costProjection.monthly_projections[costProjection.monthly_projections.length - 1];
  const absDeltaPct = Math.abs(last.delta_pct);

  // 0% delta = 100, 50%+ delta = 0
  return clamp(Math.round(100 - absDeltaPct * 2));
}

function calcRiscoScore(riskDetection: import('./types').RiskDetectionOutput): number {
  // Inverse of risk_score (which is 0–100, higher = more risk)
  return clamp(100 - riskDetection.risk_score);
}

function calcEstabilidadeScore(dataset: import('./types').WorkforceDataset): number {
  const employees = dataset.employees;
  const active = employees.filter(e => e.status === 'active');
  if (active.length === 0) return 0;

  // Tenure-based: longer average tenure = higher stability
  const now = new Date(dataset.analysis_date);
  let totalMonths = 0;
  let withHireDate = 0;

  for (const e of active) {
    if (e.hire_date) {
      const hire = new Date(e.hire_date);
      const months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
      totalMonths += Math.max(0, months);
      withHireDate++;
    }
  }

  if (withHireDate === 0) return 50; // no data, neutral

  const avgTenureMonths = totalMonths / withHireDate;

  // Scoring: 0 months = 20, 12 months = 50, 36+ months = 90, 60+ = 100
  let score: number;
  if (avgTenureMonths >= 60) score = 100;
  else if (avgTenureMonths >= 36) score = 90 + (avgTenureMonths - 36) / 24 * 10;
  else if (avgTenureMonths >= 12) score = 50 + (avgTenureMonths - 12) / 24 * 40;
  else score = 20 + (avgTenureMonths / 12) * 30;

  // Penalize if many inactive/terminated vs active
  const total = employees.length;
  const inactiveRatio = (total - active.length) / total;
  if (inactiveRatio > 0.3) score -= 20;
  else if (inactiveRatio > 0.15) score -= 10;

  return clamp(Math.round(score));
}

// ── Helpers ──

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function classify(score: number): WorkforceHealthScore['classification'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}
