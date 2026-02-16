/**
 * IBL Component 4 — MultiScopeTokenBuilder
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONCEITO CENTRAL:                                           ║
 * ║                                                              ║
 * ║  O token (MultiScopeToken) carrega IDENTIDADE + ACESSO:      ║
 * ║    { user_id, tenant_ids[], roles[], graph_version,          ║
 * ║      session_id }                                            ║
 * ║                                                              ║
 * ║  O OperationalContext NÃO fica no token.                     ║
 * ║  Ele é derivado do IdentitySession em runtime.               ║
 * ║                                                              ║
 * ║  O token é MULTI-SCOPE — carrega TODOS os tenants/roles.    ║
 * ║                                                              ║
 * ║  QueryFilterSet é construído separadamente combinando:       ║
 * ║    MultiScopeToken + OperationalContext (do caller)          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, ScopeType } from '@/domains/shared/types';
import type {
  IdentitySession,
  OperationalContext,
  AllowedScopes,
} from '../identity-boundary.types';

// ════════════════════════════════════
// MULTI-SCOPE TOKEN (identity-level, NOT context-level)
// ════════════════════════════════════

/**
 * The primary token that travels through the system.
 * 
 * IMPORTANT: This token does NOT contain OperationalContext.
 * It encodes WHO the user is and WHAT they can access across ALL tenants.
 * The WHERE (active scope) comes from OperationalContext at query time.
 */
export interface MultiScopeToken {
  /** Authenticated user ID */
  user_id: string;
  /** ALL tenant IDs the user has access to */
  tenant_ids: string[];
  /** ALL merged roles across all scopes */
  roles: TenantRole[];
  /** AccessGraph version at token build time (for cache invalidation) */
  graph_version: number | null;
  /** Session fingerprint for tracing */
  session_id: string | null;
  /** Precomputed allowed scopes from IdentitySession */
  allowed_scopes: AllowedScopes;
  /** Token generation timestamp */
  issued_at: number;
}

// ════════════════════════════════════
// QUERY FILTER SET (derived at query time from token + context)
// ════════════════════════════════════

/**
 * Precomputed filter set for database queries.
 * Built by combining MultiScopeToken (identity) + OperationalContext (where).
 * 
 * This separation means the token stays stable while the user
 * switches between tenants/groups/companies freely.
 */
export interface QueryFilterSet {
  /** Active tenant (from OperationalContext) */
  tenantId: string;
  /** If true, no group/company filters needed (tenant-wide access) */
  bypassScopeFilters: boolean;
  /** Group IDs to filter by */
  groupIds: string[];
  /** Company IDs to filter by */
  companyIds: string[];
  /** Currently selected group in UI */
  activeGroupId: string | null;
  /** Currently selected company in UI */
  activeCompanyId: string | null;
}

// ════════════════════════════════════
// LEGACY COMPAT — ScopeToken (deprecated)
// ════════════════════════════════════

/** @deprecated Use MultiScopeToken instead */
export type ScopeToken = MultiScopeToken;

// ════════════════════════════════════
// BUILDER (stateless)
// ════════════════════════════════════

export const multiScopeTokenBuilder = {
  /**
   * Build a MultiScopeToken from IdentitySession.
   * 
   * IMPORTANT: Does NOT require OperationalContext.
   * The token is identity-scoped, not context-scoped.
   */
  buildToken(identity: IdentitySession): MultiScopeToken {
    return {
      user_id: identity.userId,
      tenant_ids: [...identity.tenantIds],
      roles: [...identity.roles],
      graph_version: identity.accessGraphSnapshot?.version ?? null,
      session_id: identity.sessionFingerprint,
      allowed_scopes: identity.allowedScopes,
      issued_at: Date.now(),
    };
  },

  /**
   * @deprecated Use buildToken(identity) instead.
   * Kept for backward compatibility — builds from identity only.
   */
  buildScopeToken(
    identity: IdentitySession,
    _context?: OperationalContext,
  ): MultiScopeToken {
    return this.buildToken(identity);
  },

  /**
   * Build a QueryFilterSet for database queries.
   * 
   * Combines:
   *   - MultiScopeToken (identity: who can access what)
   *   - OperationalContext (where the user is operating right now)
   * 
   * The token stays the same; only the context changes on scope switch.
   */
  buildQueryFilters(
    token: MultiScopeToken,
    context: OperationalContext,
  ): QueryFilterSet {
    const tenantId = context.activeTenantId;
    const bypassScopeFilters = token.allowed_scopes.hasTenantWideAccess;

    // If user selected a specific company in UI
    if (context.activeCompanyId) {
      return {
        tenantId,
        bypassScopeFilters: false,
        groupIds: [],
        companyIds: [context.activeCompanyId],
        activeGroupId: context.activeGroupId,
        activeCompanyId: context.activeCompanyId,
      };
    }

    // If user selected a specific group in UI
    if (context.activeGroupId) {
      return {
        tenantId,
        bypassScopeFilters: false,
        groupIds: [context.activeGroupId],
        companyIds: [],
        activeGroupId: context.activeGroupId,
        activeCompanyId: null,
      };
    }

    // No UI narrowing: use full allowed scope set from token
    return {
      tenantId,
      bypassScopeFilters,
      groupIds: [...token.allowed_scopes.groupIds],
      companyIds: [...token.allowed_scopes.companyIds],
      activeGroupId: null,
      activeCompanyId: null,
    };
  },

  /**
   * Build a compact fingerprint for caching.
   * Two identical access profiles produce the same fingerprint.
   * 
   * Note: fingerprint is identity-level (no context),
   * so it stays valid across scope switches.
   */
  fingerprint(token: MultiScopeToken): string {
    const tenants = [...token.tenant_ids].sort().join(',');
    const roles = [...token.roles].sort().join(',');
    const groups = [...token.allowed_scopes.groupIds].sort().join(',');
    const companies = [...token.allowed_scopes.companyIds].sort().join(',');
    return `${token.user_id}:${tenants}:${roles}:${groups}:${companies}:v${token.graph_version ?? '?'}`;
  },

  /**
   * Check if a token is still valid against the current AccessGraph version.
   * If graph_version changed, the token should be rebuilt.
   */
  isStale(token: MultiScopeToken, currentGraphVersion: number | null): boolean {
    if (token.graph_version === null || currentGraphVersion === null) return false;
    return token.graph_version !== currentGraphVersion;
  },
};
