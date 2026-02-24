/**
 * Automated Offboarding — Domain Barrel Export
 */
export * from './types';
export { offboardingService } from './offboarding.service';
export { getChecklistTemplatesByType } from './checklist-templates';

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
