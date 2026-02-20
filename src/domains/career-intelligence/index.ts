/**
 * Career & Legal Intelligence Engine — Bounded Context
 *
 * Assists SMBs in structuring a PCCS (Plano de Cargos, Carreiras e Salários)
 * integrated with labor legislation and occupational health.
 *
 * Integrations:
 * - HR Core: employee/position data
 * - Occupational Intelligence: CNAE/CBO risk mapping
 * - Labor Rules Engine: CCT salary floors, legal additionals
 * - PCMSO/PGR: medical exam & safety requirements
 * - NR Training Lifecycle: training compliance
 * - Payroll Simulation: cost projection per position
 * - Workforce Intelligence: strategic insights
 * - Security Kernel: access control
 *
 * Capabilities:
 * - Structured career position management (PCCS)
 * - Automatic CBO association
 * - Legal requirement mapping per position
 * - PCMSO/PGR integration
 * - Salary benchmarking & gap analysis
 * - Legal risk alerting
 */

// ── Services ──
export { careerPositionService } from './career-position.service';
export { careerPathService } from './career-path.service';
export { legalRequirementsService } from './legal-requirements.service';
export { salaryBenchmarkService } from './salary-benchmark.service';
export { riskAlertService } from './risk-alert.service';
export { legalReferenceService } from './legal-reference.service';

// ── Engines (pure, no I/O) ──
export {
  analyzePositionCompliance,
  analyzeSalaryPositioning,
  suggestLegalRequirements,
} from './career-compliance.engine';

// ── Events ──
export { careerIntelligenceEvents, emitCareerEvent, onCareerEvent } from './career-intelligence.events';

// ── Types ──
export type {
  CareerNivel,
  TrilhaTipo,
  LegalRequirementType,
  RiscoNivel,
  BenchmarkFonte,
  AlertaTipo,
  CareerPosition,
  CareerPath,
  CareerPathStep,
  CareerLegalRequirement,
  CareerSalaryBenchmark,
  CareerRiskAlert,
  CreateCareerPositionDTO,
  CreateCareerPathDTO,
  CreateCareerPathStepDTO,
  CreateCareerLegalRequirementDTO,
  CreateCareerSalaryBenchmarkDTO,
  CreateCareerRiskAlertDTO,
  CareerPositionWithRelations,
  CareerPathWithSteps,
  CareerComplianceAnalysis,
  SalaryPositioningResult,
  LegalReferenceTipo,
  LegalReference,
  CreateLegalReferenceDTO,
} from './types';
