/**
 * Workforce Intelligence — Read Models
 *
 * Data source views consumed by the intelligence engines.
 * Also re-exports the existing payroll simulation read models.
 */

// ── New views ──
export { type SalaryStructureView, type SalaryRubricView, toSalaryStructureView } from './salary-structure.view';
export { type RiskExposureView, toRiskExposureView } from './risk-exposure.view';
export { type MedicalExamStatusView, type ExamStatus, toMedicalExamStatusView } from './medical-exam-status.view';

// ── Re-export payroll simulation views ──
export {
  type PayrollSimulationView,
  type EmployeeCostBreakdownView,
  type CompanyCostProjectionView,
  type CostLineItem,
  type GroupCostSummary,
  toPayrollSimulationView,
  toEmployeeCostBreakdownView,
  toCompanyCostProjectionView,
} from '@/domains/payroll-simulation/read-models';

// ── Dataset loader ──
export { loadWorkforceDataset } from './dataset-loader';
