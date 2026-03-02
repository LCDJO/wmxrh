/**
 * WorkforceOperationsEngine — Termination Workflow Domain
 *
 * Facade over the existing automated-offboarding domain + TerminationSimulator.
 */

export {
  offboardingService,
  calculateRescission,
  validateOffboardingPendencies,
  evaluateOffboardingRestrictions,
  archiveEmployeeProfile,
  postTerminationRiskService,
  generateAllOffboardingDocuments,
} from '@/domains/automated-offboarding';

export type {
  OffboardingWorkflow,
  OffboardingChecklistItem,
  RescissionInput,
  RescissionResult,
  OffboardingDocumentType,
  GeneratedDocument,
} from '@/domains/automated-offboarding';

// ── Termination Simulator ──
export {
  simulateTermination,
  TerminationSimulatorService,
  getTerminationSimulatorService,
} from './termination-simulator.service';

export type {
  TerminationSimulationInput,
  TerminationSimulationResult,
  TerminationScenario,
  LegalRiskScore,
  LegalRiskFactor,
  RiskLevel,
} from './termination-simulator.service';

