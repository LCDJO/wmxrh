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
} from './navigation-governance-events';

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
export type { NavigationVersion, NavigationDiff, RollbackResult } from './navigation-version-manager';

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
