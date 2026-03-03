/**
 * Navigation Governance Domain — Public API
 */

// Domain Events
export { NAVIGATION_GOVERNANCE_EVENTS } from './navigation-governance-events';
export type {
  NavigationRefactorProposedPayload,
  NavigationVersionCreatedPayload,
  NavigationRefactorAppliedPayload,
  NavigationRollbackExecutedPayload,
  NavigationDraftCreatedPayload,
  NavigationDraftApprovedPayload,
  NavigationDraftRejectedPayload,
} from './navigation-governance-events';

// Event Emitter
export { emitNavigationEvent, onNavigationEvent } from './navigation-event-emitter';

// Classification
export {
  MODULE_DOMAINS,
  DOMAIN_METADATA,
  classifyModule,
  getModuleClassification,
  groupModulesByDomain,
  getModulesByDomain,
  getDomainsByScope,
} from './menu-domain-classifier';
export type { ModuleDomain, DomainClassification } from './menu-domain-classifier';

// Hierarchy
export { buildMenuHierarchy, flattenHierarchy } from './menu-hierarchy-builder';
export type { MenuNode, MenuHierarchy } from './menu-hierarchy-builder';

// Visibility
export { resolvePermissionVisibility } from './permission-visibility-resolver';
export { resolvePlanVisibility } from './plan-visibility-resolver';

// Versioning & Rollback
export {
  createNavigationVersion,
  getLatestVersion,
  getVersion,
  listVersions,
  diffVersions,
  rollbackToVersion,
} from './navigation-version-manager';
export type { NavigationVersion, NavigationDiff, DiffChange, RollbackResult } from './navigation-version-manager';

// Controlled Execution (Draft → Preview → Approve → Apply)
export {
  createNavigationDraft,
  previewDraft,
  listDrafts,
  submitDraftForApproval,
  approveDraft,
  rejectDraft,
  applyApprovedDraft,
  getDraft,
  expireOldDrafts,
} from './navigation-controlled-execution';
export type {
  NavigationDraft,
  DraftStatus,
  DraftApproval,
  DraftRejection,
  CreateDraftInput,
  ApplyResult,
} from './navigation-controlled-execution';

// Rule Validator
export {
  validateNavigationRules,
  NAVIGATION_RULES,
} from './navigation-rule-validator';
export type {
  RuleViolation,
  RuleSeverity,
  ValidationResult,
} from './navigation-rule-validator';

// Engine
export {
  createNavigationRefactorEngine,
  getNavigationRefactorEngine,
} from './navigation-refactor-engine';
export type {
  NavigationRefactorEngineAPI,
  ResolveOptions,
  ResolvedNavigation,
} from './navigation-refactor-engine';

// Panel Context (isolated SaaS vs Tenant)
export {
  NavigationPanelProvider,
  useNavigationPanel,
  useCurrentPanelNavigation,
  usePanelGuard,
} from './navigation-panel-context';
export type { PanelScope, PanelNavigationState } from './navigation-panel-context';
