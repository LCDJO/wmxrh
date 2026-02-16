/**
 * Workforce Intelligence Engine — Bounded Context
 *
 * Strategic workforce analysis module that consumes data from
 * HR Core, Compensation, Labor Rules, Payroll Simulation,
 * Compliance (PCMSO/PGR), and Benefits engines.
 *
 * Capabilities:
 *   - CLT cost projection (3/6/12/24 months)
 *   - Salary analysis by organizational group
 *   - Labor risk detection & scoring
 *   - Automated strategic insights for HR & Finance
 *
 * Architecture:
 *   - Pure engines (no I/O, no side effects)
 *   - Orchestrator composes all engines into a single report
 *   - All inputs are snapshots from other bounded contexts
 *   - CQRS-friendly: outputs are read-only projections
 */

// ── Orchestrator (main entry point) ──
export { generateIntelligenceReport, type IntelligenceConfig } from './workforce-intelligence.orchestrator';

// ── Individual engines ──
export { projectCosts } from './cost-projection.engine';
export { analyzeSalaries } from './salary-analysis.engine';
export { detectRisks } from './risk-detection.engine';
export { generateInsights } from './insight-generator.engine';
export { computeHealthScore } from './health-score.engine';

// ── Read Models (data sources) ──
export * from './read-models';

// ── Types ──
export type {
  // Input snapshots
  EmployeeSnapshot,
  SimulationSnapshot,
  ComplianceSnapshot,
  BenefitSnapshot,
  WorkforceDataset,

  // Cost projection
  CostProjectionInput,
  CostProjectionOutput,
  MonthlyCostProjection,
  CostDriver,
  CostProjectionSummary,
  ProjectionHorizon,
  ScheduledAdjustment,
  ActiveCCT,

  // Salary analysis
  SalaryAnalysisInput,
  SalaryAnalysisOutput,
  SalaryGroupStats,
  SalaryEquityAlert,
  SalaryInsight,

  // Risk detection
  RiskDetectionInput,
  RiskDetectionOutput,
  LaborRisk,
  RiskCategory,
  WorkforceInsightType,

  // Health score
  WorkforceHealthScore,
  HealthScoreInput,

  // Insights
  InsightGenerationOutput,
  StrategicInsight,
  InsightCategory,

  // Full report
  WorkforceIntelligenceReport,
} from './types';
