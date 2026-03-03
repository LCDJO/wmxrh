/**
 * NavigationRefactorEngine — Aggregate factory
 *
 * Wires all sub-engines:
 *   MenuDomainClassifier
 *   MenuHierarchyBuilder
 *   PermissionVisibilityResolver
 *   PlanBasedVisibilityResolver
 *   NavigationVersionManager
 *   NavigationDiffAnalyzer
 *   RollbackNavigationService
 */

import type { TenantRole } from '@/domains/shared/types';
import type { MenuHierarchy, MenuNode } from './menu-hierarchy-builder';
import type { NavigationVersion, NavigationDiff, RollbackResult } from './navigation-version-manager';
import type { ModuleDomain, DomainClassification } from './menu-domain-classifier';
import type { NavigationDraft, CreateDraftInput, ApplyResult, DraftStatus } from './navigation-controlled-execution';

import {
  classifyModule,
  getModuleClassification,
  groupModulesByDomain,
  getModulesByDomain,
  getDomainsByScope,
  DOMAIN_METADATA,
} from './menu-domain-classifier';
import { buildMenuHierarchy, flattenHierarchy } from './menu-hierarchy-builder';
import { resolvePermissionVisibility } from './permission-visibility-resolver';
import { resolvePlanVisibility } from './plan-visibility-resolver';
import {
  createNavigationVersion,
  getLatestVersion,
  getVersion,
  listVersions,
  diffVersions,
  rollbackToVersion,
} from './navigation-version-manager';
import { NAVIGATION_GOVERNANCE_EVENTS } from './navigation-governance-events';
import {
  createNavigationDraft,
  previewDraft,
  listDrafts,
  submitDraftForApproval,
  approveDraft,
  rejectDraft,
  applyApprovedDraft,
  getDraft,
} from './navigation-controlled-execution';

// ── Public API ───────────────────────────────────────────────

export interface NavigationRefactorEngineAPI {
  // Classification
  classifyModule: (key: string) => ModuleDomain;
  getModuleClassification: (key: string) => DomainClassification;
  groupModulesByDomain: (keys: string[]) => Record<ModuleDomain, string[]>;
  getModulesByDomain: (domain: ModuleDomain) => string[];
  getDomainsByScope: (scope: 'platform' | 'tenant') => DomainClassification[];
  domainMetadata: typeof DOMAIN_METADATA;

  // Hierarchy
  buildHierarchy: (allowedModules?: string[]) => MenuHierarchy;
  flattenHierarchy: (tree: MenuNode[]) => MenuNode[];

  // Visibility resolution (layered pipeline)
  resolve: (opts: ResolveOptions) => ResolvedNavigation;

  // Versioning
  createVersion: (snapshot: MenuHierarchy, by: string, desc?: string) => NavigationVersion;
  latestVersion: () => NavigationVersion | undefined;
  getVersion: (n: number) => NavigationVersion | undefined;
  listVersions: () => NavigationVersion[];
  diffVersions: (from: number, to: number) => NavigationDiff | null;
  rollback: (targetVersion: number, by: string) => RollbackResult;

  // Controlled Execution (Draft → Approve → Apply)
  createDraft: (input: CreateDraftInput) => NavigationDraft;
  previewDraft: (draftId: string) => NavigationDraft | null;
  listDrafts: (status?: DraftStatus) => NavigationDraft[];
  submitForApproval: (draftId: string) => { draft: NavigationDraft | null; blocked: boolean; reason?: string };
  approveDraft: (draftId: string, approvedBy: string, notes?: string) => NavigationDraft | null;
  rejectDraft: (draftId: string, rejectedBy: string, reason: string) => NavigationDraft | null;
  applyDraft: (draftId: string) => ApplyResult;
  getDraft: (draftId: string) => NavigationDraft | null;

  // Events
  events: typeof NAVIGATION_GOVERNANCE_EVENTS;
}

export interface ResolveOptions {
  roles: TenantRole[];
  allowedModules: string[];
  isModuleAccessible?: (key: string) => boolean;
  scope?: 'platform' | 'tenant' | 'both';
}

export interface ResolvedNavigation {
  platform: MenuNode[];
  tenant: MenuNode[];
  hidden_by_rbac: number;
  gated_by_plan: string[];
  resolved_at: number;
}

/**
 * Create the NavigationRefactorEngine singleton.
 */
export function createNavigationRefactorEngine(): NavigationRefactorEngineAPI {
  function resolve(opts: ResolveOptions): ResolvedNavigation {
    // 1. Build full hierarchy with plan-allowed modules
    const hierarchy = buildMenuHierarchy(
      opts.scope === 'platform' ? undefined : opts.allowedModules,
    );

    // 2. Plan-based filtering (tenant side)
    const planResult = resolvePlanVisibility(
      hierarchy.tenant,
      opts.allowedModules,
      opts.isModuleAccessible,
    );

    // 3. RBAC filtering (both sides)
    const platformRbac = resolvePermissionVisibility(
      hierarchy.platform,
      opts.roles,
    );
    const tenantRbac = resolvePermissionVisibility(
      planResult.visible,
      opts.roles,
    );

    return {
      platform: opts.scope === 'tenant' ? [] : platformRbac.visible,
      tenant: opts.scope === 'platform' ? [] : tenantRbac.visible,
      hidden_by_rbac: platformRbac.hidden_count + tenantRbac.hidden_count,
      gated_by_plan: planResult.gated_modules,
      resolved_at: Date.now(),
    };
  }

  return {
    classifyModule,
    getModuleClassification,
    groupModulesByDomain,
    getModulesByDomain,
    getDomainsByScope,
    domainMetadata: DOMAIN_METADATA,

    buildHierarchy: buildMenuHierarchy,
    flattenHierarchy,

    resolve,

    createVersion: createNavigationVersion,
    latestVersion: getLatestVersion,
    getVersion,
    listVersions,
    diffVersions,
    rollback: rollbackToVersion,

    createDraft: createNavigationDraft,
    previewDraft,
    listDrafts,
    submitForApproval: submitDraftForApproval,
    approveDraft,
    rejectDraft,
    applyDraft: applyApprovedDraft,
    getDraft,

    events: NAVIGATION_GOVERNANCE_EVENTS,
  };
}

// ── Singleton ────────────────────────────────────────────────

let _instance: NavigationRefactorEngineAPI | null = null;

export function getNavigationRefactorEngine(): NavigationRefactorEngineAPI {
  if (!_instance) _instance = createNavigationRefactorEngine();
  return _instance;
}
