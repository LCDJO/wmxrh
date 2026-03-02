/**
 * WorkforceOperationsEngine — Termination Workflow Domain
 *
 * Facade over the existing automated-offboarding domain.
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
