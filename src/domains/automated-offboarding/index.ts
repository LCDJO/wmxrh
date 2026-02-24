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

// ── Etapa 3: Rescission Calculator ──
export {
  calculateRescission,
  calculateAvisoPrevioDays,
  calculateProportionalMonths,
} from './rescission-calculator.engine';
export type {
  RescissionInput,
  RescissionLineItem,
  RescissionResult,
} from './rescission-calculator.engine';

// ── Termo de Rescisão Document (legacy) ──
export { generateTermoRescisaoHtml } from './rescission-document.generator';
export type { TermoRescisaoData } from './rescission-document.generator';

// ── Etapa 4: Offboarding Documents Engine ──
export {
  generateAllOffboardingDocuments,
  generateTrctHtml,
  generateTermoQuitacaoHtml,
  generateCartaDemissaoHtml,
  generateReciboDevolucaoBensHtml,
  DOCUMENT_TYPE_LABELS,
} from './offboarding-documents.engine';
export type {
  OffboardingDocumentType,
  IntegrityProof,
  OffboardingDocumentContext,
  GeneratedDocument,
  GenerateAllDocumentsInput,
  AssetItem,
} from './offboarding-documents.engine';
