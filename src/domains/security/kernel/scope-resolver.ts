/**
 * SecurityKernel — ScopeResolver
 * 
 * Resolves the effective data scope for a user.
 * 
 * ╔══════════════════════════════════════════════════════════╗
 * ║  REGRA DE OURO: tenant_id NUNCA vem do frontend.        ║
 * ║  Sempre derivado do SecurityContext (JWT → membership).  ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * Hierarquia:
 *   Tenant (superadmin, owner, admin, tenant_admin)
 *     └── Group (group_admin)
 *           └── Company (company_admin)
 * 
 * All query builders and guards consume ScopeResolution.
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import type { SecurityContext, SecurityScope } from './identity.service';
import { computeScopeFilters } from '@/domains/shared/scoped-query';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface ScopeResolution {
  /** Derived from SecurityContext — NEVER from frontend input */
  tenantId: string;
  /** Effective scope level after resolution */
  effectiveLevel: ScopeType;
  /** Whether user has full tenant access */
  hasTenantScope: boolean;
  /** Group IDs user can access (empty = all or none depending on hasTenantScope) */
  allowedGroupIds: string[];
  /** Company IDs user can access (empty = all or none depending on hasTenantScope) */
  allowedCompanyIds: string[];
  /** Current UI-narrowed scope (always clamped to effective permissions) */
  uiScope: {
    level: ScopeType;
    groupId: string | null;
    companyId: string | null;
  };
}

/** Input for resolveScope — used internally by buildSecurityContext */
export interface ScopeResolverInput {
  tenantId: string;
  userRoles: UserRole[];
  membershipRole: TenantRole | null;
  uiScopeLevel: ScopeType;
  uiGroupId: string | null;
  uiCompanyId: string | null;
}

// ════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════

const TENANT_WIDE_ROLES: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

// ════════════════════════════════════
// PRIMARY RESOLVER (from SecurityContext)
// ════════════════════════════════════

/**
 * Resolve scope directly from a SecurityContext.
 * This is the PREFERRED entry point — tenant_id is taken from
 * the already-validated SecurityContext, never from raw frontend input.
 */
export function resolveScopeFromContext(ctx: SecurityContext): ScopeResolution {
  const { hasTenantScope, allowedGroupIds, allowedCompanyIds } =
    computeScopeFromSecurityScopes(ctx.scopes, ctx.roles);

  const effectiveLevel = computeEffectiveLevel(hasTenantScope, allowedGroupIds, allowedCompanyIds);

  // Clamp UI scope to effective permissions
  const uiScope = clampUiScope(
    ctx.meta.scopeResolution.uiScope,
    { hasTenantScope, allowedGroupIds, allowedCompanyIds },
  );

  return {
    tenantId: ctx.tenant_id, // from SecurityContext, never frontend
    effectiveLevel,
    hasTenantScope,
    allowedGroupIds,
    allowedCompanyIds,
    uiScope,
  };
}

// ════════════════════════════════════
// INTERNAL RESOLVER (for buildSecurityContext bootstrap)
// ════════════════════════════════════

/**
 * Resolve scope from raw inputs. Used ONLY by buildSecurityContext during
 * the initial SecurityContext construction (chicken-and-egg).
 * 
 * After construction, always use resolveScopeFromContext.
 */
export function resolveScope(input: ScopeResolverInput): ScopeResolution {
  const { tenantId, userRoles, membershipRole, uiScopeLevel, uiGroupId, uiCompanyId } = input;

  const { hasTenantScope: hasTenantFromRoles, allowedGroupIds, allowedCompanyIds } =
    computeScopeFilters(userRoles);

  const hasTenantScope =
    hasTenantFromRoles ||
    (membershipRole ? TENANT_WIDE_ROLES.includes(membershipRole) : false);

  const effectiveLevel = computeEffectiveLevel(hasTenantScope, allowedGroupIds, allowedCompanyIds);

  const uiScope = clampUiScope(
    { level: uiScopeLevel, groupId: uiGroupId, companyId: uiCompanyId },
    { hasTenantScope, allowedGroupIds, allowedCompanyIds },
  );

  return {
    tenantId,
    effectiveLevel,
    hasTenantScope,
    allowedGroupIds,
    allowedCompanyIds,
    uiScope,
  };
}

// ════════════════════════════════════
// QUERY SCOPE BUILDER
// ════════════════════════════════════

export interface ResolvedQueryScope {
  tenantId: string;
  userRoles: UserRole[];
  scopeLevel: ScopeType;
  groupId: string | null;
  companyId: string | null;
}

/**
 * Build a QueryScope for applyScope() from SecurityContext.
 * Ensures tenant_id comes from the validated context.
 */
export function buildQueryScope(ctx: SecurityContext): ResolvedQueryScope {
  const sr = ctx.meta.scopeResolution;
  return {
    tenantId: ctx.tenant_id,
    userRoles: ctx.scopes.map(s => ({
      scope_type: s.type,
      scope_id: s.id,
    })) as UserRole[],
    scopeLevel: sr.uiScope.level,
    groupId: sr.uiScope.groupId,
    companyId: sr.uiScope.companyId,
  };
}

/**
 * Build a scoped INSERT payload. Injects tenant_id from SecurityContext.
 * Strips any client-supplied tenant_id to prevent injection.
 */
export function scopedInsertFromContext<T extends Record<string, unknown>>(
  dto: T,
  ctx: SecurityContext,
): T {
  const result = { ...dto };
  // Always override tenant_id — never trust frontend
  (result as any).tenant_id = ctx.tenant_id;
  return result as T;
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

function computeScopeFromSecurityScopes(
  scopes: SecurityScope[],
  roles: TenantRole[],
): { hasTenantScope: boolean; allowedGroupIds: string[]; allowedCompanyIds: string[] } {
  const hasTenantScope =
    scopes.some(s => s.type === 'tenant') ||
    roles.some(r => TENANT_WIDE_ROLES.includes(r));

  if (hasTenantScope) {
    return { hasTenantScope: true, allowedGroupIds: [], allowedCompanyIds: [] };
  }

  const allowedGroupIds = [
    ...new Set(
      scopes
        .filter(s => s.type === 'company_group' && s.id)
        .map(s => s.id!)
    ),
  ];

  const allowedCompanyIds = [
    ...new Set(
      scopes
        .filter(s => s.type === 'company' && s.id)
        .map(s => s.id!)
    ),
  ];

  return { hasTenantScope: false, allowedGroupIds, allowedCompanyIds };
}

function computeEffectiveLevel(
  hasTenantScope: boolean,
  allowedGroupIds: string[],
  allowedCompanyIds: string[],
): ScopeType {
  if (hasTenantScope) return 'tenant';
  if (allowedGroupIds.length > 0 && allowedCompanyIds.length === 0) return 'company_group';
  if (allowedCompanyIds.length > 0) return 'company';
  return 'tenant'; // fallback — RLS enforces actual access
}

/**
 * Clamp UI scope selection to what the user is actually allowed to see.
 * Prevents UI from selecting a group/company the user has no access to.
 */
function clampUiScope(
  ui: { level: ScopeType; groupId: string | null; companyId: string | null },
  perms: { hasTenantScope: boolean; allowedGroupIds: string[]; allowedCompanyIds: string[] },
): { level: ScopeType; groupId: string | null; companyId: string | null } {
  // Tenant-wide users can select anything
  if (perms.hasTenantScope) return ui;

  // Group-scoped: clamp to allowed groups
  if (ui.groupId && perms.allowedGroupIds.length > 0) {
    if (!perms.allowedGroupIds.includes(ui.groupId)) {
      return { level: 'company_group', groupId: perms.allowedGroupIds[0], companyId: null };
    }
  }

  // Company-scoped: clamp to allowed companies
  if (ui.companyId && perms.allowedCompanyIds.length > 0) {
    if (!perms.allowedCompanyIds.includes(ui.companyId)) {
      return { level: 'company', groupId: ui.groupId, companyId: perms.allowedCompanyIds[0] };
    }
  }

  return ui;
}
