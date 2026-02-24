/**
 * Automated Offboarding — Domain Barrel Export
 */
export * from './types';
export { offboardingService } from './offboarding.service';
export { getChecklistTemplatesByType } from './checklist-templates';

// ── Pendency Validation Engine (Etapa 2) ──
export {
  validateOffboardingPendencies,
  pendenciesToChecklistItems,
} from './pendency-validation.engine';
export type {
  PendencyCategory,
  PendencySeverity,
  OffboardingPendency,
  PendencyValidationResult,
} from './pendency-validation.engine';

// ── Operational Blocks Engine ──
export {
  evaluateOffboardingRestrictions,
  checkOffboardingOperationAllowed,
  canTransferEmployee,
  canIssueDisciplinaryAction,
  canAmendContract,
  canChangeSalary,
  canRequestVacation,
  canRehire,
} from './offboarding-blocks.engine';
export type {
  OffboardingRestriction,
  OffboardingBlockSeverity,
  OffboardingBlock,
  OffboardingRestrictionProfile,
  OffboardingRestrictionCheckResult,
} from './offboarding-blocks.engine';
