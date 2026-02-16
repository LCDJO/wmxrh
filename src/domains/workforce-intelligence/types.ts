/**
 * Workforce Intelligence Engine — Type Contracts
 *
 * This Bounded Context does NOT perform direct labor calculations.
 * It consumes outputs from:
 *   - HR Core (employees, departments, positions)
 *   - Compensation Engine (salary contracts, adjustments)
 *   - Labor Rules Engine (rubrics, rule definitions)
 *   - Payroll Simulation Engine (simulation outputs, encargos)
 *   - Labor Compliance (PCMSO/PGR, violations)
 *   - Benefits Engine (benefit plans, enrollments)
 *
 * Purpose: Transform operational data into strategic intelligence.
 */

// ══════════════════════════════════════════════════════════════
// INPUT SNAPSHOTS — data consumed from other bounded contexts
// ══════════════════════════════════════════════════════════════

/** Snapshot of an employee for intelligence analysis */
export interface EmployeeSnapshot {
  id: string;
  name: string;
  department?: string;
  department_id?: string;
  position?: string;
  position_id?: string;
  company_id: string;
  company_group_id?: string;
  status: string;
  hire_date?: string;
  base_salary: number;
  current_salary: number;
}

/** Snapshot of a payroll simulation result */
export interface SimulationSnapshot {
  employee_id: string;
  salario_base: number;
  total_proventos: number;
  total_descontos: number;
  salario_liquido: number;
  custo_total_empregador: number;
  fator_custo: number;
  encargos_total: number;
  inss_estimado: number;
  irrf_estimado: number;
  fgts_estimado: number;
  provisoes_total: number;
  beneficios_total: number;
  rubrics_count: number;
}

/** Snapshot of compliance state */
export interface ComplianceSnapshot {
  employee_id: string;
  has_active_exam: boolean;
  exam_overdue: boolean;
  days_until_exam_expiry?: number;
  has_risk_exposure: boolean;
  risk_level?: string;
  has_hazard_pay: boolean;
  hazard_pay_type?: string;
  open_violations: number;
  violation_severities: string[];
}

/** Snapshot of benefit enrollment */
export interface BenefitSnapshot {
  employee_id: string;
  plan_name: string;
  benefit_type: string;
  monthly_value: number;
  employer_cost: number;
  is_active: boolean;
}

/** Full workforce dataset for analysis */
export interface WorkforceDataset {
  tenant_id: string;
  analysis_date: string;
  employees: EmployeeSnapshot[];
  simulations: SimulationSnapshot[];
  compliance: ComplianceSnapshot[];
  benefits: BenefitSnapshot[];
}

// ══════════════════════════════════════════════════════════════
// COST PROJECTION — CLT cost forecasting
// ══════════════════════════════════════════════════════════════

export type ProjectionHorizon = 3 | 6 | 12 | 24;

export interface CostProjectionInput {
  dataset: WorkforceDataset;
  horizon_months: ProjectionHorizon;
  /** Annual salary adjustment rate (e.g., 0.05 = 5%) */
  salary_adjustment_rate?: number;
  /** Projected headcount changes per month */
  headcount_delta?: number;
  /** Inflation rate for benefit costs */
  benefit_inflation_rate?: number;
}

export interface MonthlyCostProjection {
  month: string; // YYYY-MM
  headcount: number;
  total_salario_base: number;
  total_proventos: number;
  total_encargos: number;
  total_provisoes: number;
  total_beneficios: number;
  custo_total_empregador: number;
  delta_vs_current: number;
  delta_pct: number;
}

export interface CostProjectionOutput {
  horizon_months: ProjectionHorizon;
  baseline_monthly_cost: number;
  projected_monthly_avg: number;
  projected_annual_total: number;
  monthly_projections: MonthlyCostProjection[];
  cost_drivers: CostDriver[];
  assumptions: string[];
  is_projection: true;
}

export interface CostDriver {
  driver: string;
  impact_monthly: number;
  impact_pct: number;
  category: 'salary' | 'headcount' | 'encargo' | 'benefit' | 'provision';
}

// ══════════════════════════════════════════════════════════════
// SALARY ANALYSIS — compensation intelligence by group
// ══════════════════════════════════════════════════════════════

export interface SalaryAnalysisInput {
  dataset: WorkforceDataset;
  group_by: 'department' | 'position' | 'company' | 'company_group';
}

export interface SalaryGroupStats {
  group_key: string;
  group_name: string;
  headcount: number;
  min_salary: number;
  max_salary: number;
  avg_salary: number;
  median_salary: number;
  p25_salary: number;
  p75_salary: number;
  std_deviation: number;
  total_folha: number;
  avg_fator_custo: number;
  salary_spread: number; // max/min ratio
}

export interface SalaryEquityAlert {
  alert_type: 'gender_gap' | 'role_disparity' | 'compression' | 'outlier';
  severity: 'info' | 'warning' | 'critical';
  group: string;
  message: string;
  affected_employees: string[];
  details: Record<string, unknown>;
}

export interface SalaryAnalysisOutput {
  group_by: string;
  groups: SalaryGroupStats[];
  overall: SalaryGroupStats;
  equity_alerts: SalaryEquityAlert[];
  distribution_skew: 'left' | 'normal' | 'right';
  compa_ratio_avg: number;
}

// ══════════════════════════════════════════════════════════════
// RISK DETECTION — labor risk intelligence
// ══════════════════════════════════════════════════════════════

export type RiskCategory =
  | 'salary_compliance'
  | 'overtime_exposure'
  | 'health_safety'
  | 'benefit_gap'
  | 'contract_irregularity'
  | 'cost_anomaly'
  | 'turnover_risk';

export interface LaborRisk {
  risk_id: string;
  category: RiskCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affected_employees: string[];
  affected_count: number;
  financial_exposure: number;
  legal_basis?: string;
  recommended_action: string;
  detection_date: string;
}

export interface RiskDetectionInput {
  dataset: WorkforceDataset;
  /** CCT salary floor for comparison */
  piso_cct?: number;
  /** Maximum overtime hours per month (CLT default: 44) */
  max_overtime_hours?: number;
}

export interface RiskDetectionOutput {
  total_risks: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_financial_exposure: number;
  risks: LaborRisk[];
  risk_score: number; // 0-100, higher = more risk
  risk_trend: 'improving' | 'stable' | 'deteriorating';
}

// ══════════════════════════════════════════════════════════════
// INSIGHTS — automated strategic insights
// ══════════════════════════════════════════════════════════════

export type InsightCategory =
  | 'cost_optimization'
  | 'compliance_alert'
  | 'workforce_trend'
  | 'benefit_recommendation'
  | 'salary_action';

export interface StrategicInsight {
  insight_id: string;
  category: InsightCategory;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  summary: string;
  detail: string;
  impact_estimate?: number;
  recommended_actions: string[];
  data_points: Record<string, number>;
  audience: ('hr' | 'finance' | 'legal' | 'executive')[];
}

export interface InsightGenerationOutput {
  generated_at: string;
  total_insights: number;
  urgent_count: number;
  insights: StrategicInsight[];
  executive_summary: string;
}

// ══════════════════════════════════════════════════════════════
// FULL INTELLIGENCE REPORT
// ══════════════════════════════════════════════════════════════

export interface WorkforceIntelligenceReport {
  tenant_id: string;
  generated_at: string;
  period: string;
  cost_projection: CostProjectionOutput;
  salary_analysis: SalaryAnalysisOutput;
  risk_detection: RiskDetectionOutput;
  insights: InsightGenerationOutput;
  is_intelligence_report: true;
}
