/**
 * IBL Component 3 — ContextResolver
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Resolves the active operational context using 3 strategies  ║
 * ║  (in priority order):                                        ║
 * ║                                                              ║
 * ║    1. SUBDOMAIN  → tenant.domain.com (future-ready)          ║
 * ║    2. MANUAL     → explicit user selection via UI             ║
 * ║    3. PERSISTED  → last saved context from localStorage      ║
 * ║                                                              ║
 * ║  Also provides pure-function utilities:                      ║
 * ║    - resolve()            → compute effective roles           ║
 * ║    - validateScopeAccess()→ check scope grants                ║
 * ║    - resolveInitial()     → auto-resolve on login/restore     ║
 * ║                                                              ║
 * ║  NO EXTERNAL SIDE EFFECTS (except localStorage R/W).         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import type { IdentitySession, TenantScope, ContextSwitchRequest } from '../identity-boundary.types';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface ResolvedContext {
  /** Effective roles for the target tenant */
  effectiveRoles: TenantRole[];
  /** User roles scoped to the target tenant */
  tenantUserRoles: ReadonlyArray<UserRole>;
}

export interface ScopeValidation {
  allowed: boolean;
  reason: string;
}

export type ResolutionStrategy = 'subdomain' | 'manual' | 'persisted' | 'default';

export interface InitialContextResolution {
  /** The resolved switch request to apply */
  request: ContextSwitchRequest;
  /** Which strategy resolved it */
  resolvedBy: ResolutionStrategy;
  /** Explanation for debugging */
  reason: string;
}

/**
 * Persisted context state saved to localStorage.
 * Keyed by userId to support multi-user scenarios.
 */
export interface PersistedContext {
  tenantId: string;
  scopeLevel: ScopeType;
  groupId: string | null;
  companyId: string | null;
  savedAt: number;
}

// ════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════

const TENANT_WIDE_ROLES: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

const STORAGE_KEY_PREFIX = 'ibl:context:';
/** Max age for persisted context: 30 days */
const PERSISTED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ════════════════════════════════════
// SUBDOMAIN RESOLVER (Strategy 1)
// ════════════════════════════════════

/**
 * Extract tenant slug from subdomain.
 * Supports patterns:
 *   - tenant.domain.com → 'tenant'
 *   - tenant.app.domain.com → 'tenant'
 * 
 * Returns null if:
 *   - No subdomain (domain.com, www.domain.com)
 *   - localhost / IP address
 *   - Preview/staging URLs (*.lovable.app, *.lovableproject.com)
 */
function resolveSubdomainTenant(): string | null {
  try {
    const hostname = window.location.hostname;

    // Skip localhost, IPs, and preview URLs
    if (
      hostname === 'localhost' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
      hostname.endsWith('.lovable.app') ||
      hostname.endsWith('.lovableproject.com')
    ) {
      return null;
    }

    const parts = hostname.split('.');
    // Need at least 3 parts: subdomain.domain.tld
    if (parts.length < 3) return null;

    const subdomain = parts[0];
    // Skip 'www' — it's not a tenant
    if (subdomain === 'www') return null;

    return subdomain;
  } catch {
    return null;
  }
}

// ════════════════════════════════════
// PERSISTENCE (Strategy 3)
// ════════════════════════════════════

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function loadPersistedContext(userId: string): PersistedContext | null {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;

    const parsed: PersistedContext = JSON.parse(raw);

    // Check TTL
    if (Date.now() - parsed.savedAt > PERSISTED_TTL_MS) {
      localStorage.removeItem(getStorageKey(userId));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function savePersistedContext(userId: string, context: PersistedContext): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(context));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function clearPersistedContext(userId: string): void {
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch {
    // Silently ignore
  }
}

// ════════════════════════════════════
// RESOLVER
// ════════════════════════════════════

export const contextResolver = {
  /**
   * Resolve effective roles and tenant-scoped user_roles for a target tenant.
   * Pure computation — no side effects.
   */
  resolve(
    identity: IdentitySession,
    membershipRole: TenantRole,
    targetTenantId: string,
  ): ResolvedContext {
    const tenantUserRoles = identity.allUserRoles.filter(
      r => r.tenant_id === targetTenantId
    );

    const roles = new Set<TenantRole>();
    roles.add(membershipRole);
    for (const ur of tenantUserRoles) {
      roles.add(ur.role);
    }

    return {
      effectiveRoles: Array.from(roles),
      tenantUserRoles,
    };
  },

  /**
   * Validate whether the given roles grant access to the specified scope.
   * Pure validation — no side effects.
   */
  validateScopeAccess(
    effectiveRoles: TenantRole[],
    userRoles: ReadonlyArray<UserRole>,
    scopeLevel: ScopeType,
    groupId: string | null,
    companyId: string | null,
  ): ScopeValidation {
    // Tenant-wide roles can access any scope
    if (effectiveRoles.some(r => TENANT_WIDE_ROLES.includes(r))) {
      return { allowed: true, reason: 'Tenant-wide access' };
    }

    // Tenant level: always allowed (RLS enforces actual data access)
    if (scopeLevel === 'tenant') {
      return { allowed: true, reason: 'Tenant scope allowed (RLS enforces data access)' };
    }

    // Group scope: user must have a role scoped to this group
    if (scopeLevel === 'company_group' && groupId) {
      const hasGroupAccess = userRoles.some(
        r => r.scope_type === 'company_group' && r.scope_id === groupId
      ) || userRoles.some(r => r.scope_type === 'tenant');

      if (!hasGroupAccess) {
        return { allowed: false, reason: `Sem acesso ao grupo ${groupId}` };
      }
    }

    // Company scope: user must have company or group access
    if (scopeLevel === 'company' && companyId) {
      const hasCompanyAccess = userRoles.some(
        r => r.scope_type === 'company' && r.scope_id === companyId
      ) || userRoles.some(
        r => r.scope_type === 'company_group'
      ) || userRoles.some(r => r.scope_type === 'tenant');

      if (!hasCompanyAccess) {
        return { allowed: false, reason: `Sem acesso à empresa ${companyId}` };
      }
    }

    return { allowed: true, reason: 'Scope access validated' };
  },

  /**
   * Check if user has tenant-wide access in the given roles.
   */
  hasTenantWideAccess(effectiveRoles: TenantRole[]): boolean {
    return effectiveRoles.some(r => TENANT_WIDE_ROLES.includes(r));
  },

  // ════════════════════════════════════
  // AUTO-RESOLUTION (3 strategies)
  // ════════════════════════════════════

  /**
   * Automatically resolve the initial context on login/session restore.
   * 
   * Priority:
   *   1. SUBDOMAIN  → tenant slug from URL (future tenant.domain.com)
   *   2. PERSISTED  → last saved context from localStorage
   *   3. DEFAULT    → first tenant in identity.tenantScopes
   * 
   * Note: "MANUAL" is not part of auto-resolution — it's triggered
   * explicitly by the user via the ContextSwitcherService.
   * 
   * @param identity - The established IdentitySession
   * @returns InitialContextResolution with the request to apply
   */
  resolveInitial(identity: IdentitySession): InitialContextResolution {
    // ── Strategy 1: Subdomain ──
    const subdomainSlug = resolveSubdomainTenant();
    if (subdomainSlug) {
      const matched = this._matchTenantBySlug(identity.tenantScopes, subdomainSlug);
      if (matched) {
        return {
          request: { targetTenantId: matched.tenantId },
          resolvedBy: 'subdomain',
          reason: `Tenant resolved from subdomain: ${subdomainSlug} → ${matched.tenantId}`,
        };
      }
      // Subdomain didn't match any tenant — fall through
    }

    // ── Strategy 2: Persisted context ──
    const persisted = loadPersistedContext(identity.userId);
    if (persisted) {
      // Validate the persisted tenant is still accessible
      const tenantStillAccessible = identity.tenantScopes.some(
        m => m.tenantId === persisted.tenantId
      );

      if (tenantStillAccessible) {
        return {
          request: {
            targetTenantId: persisted.tenantId,
            targetScopeLevel: persisted.scopeLevel,
            targetGroupId: persisted.groupId,
            targetCompanyId: persisted.companyId,
          },
          resolvedBy: 'persisted',
          reason: `Restored from saved context (saved ${new Date(persisted.savedAt).toISOString()})`,
        };
      }
      // Persisted tenant no longer accessible — clear and fall through
      clearPersistedContext(identity.userId);
    }

    // ── Strategy 3: Default (first tenant) ──
    const defaultTenant = identity.tenantScopes[0];
    if (defaultTenant) {
      return {
        request: { targetTenantId: defaultTenant.tenantId },
        resolvedBy: 'default',
        reason: `Default: first tenant ${defaultTenant.tenantName} (${defaultTenant.tenantId})`,
      };
    }

    // Edge case: no tenants at all
    return {
      request: {},
      resolvedBy: 'default',
      reason: 'No tenants available in identity',
    };
  },

  /**
   * Persist the current context for future sessions.
   * Called by ContextSwitcherService after a successful switch.
   */
  persistContext(userId: string, tenantId: string, scopeLevel: ScopeType, groupId: string | null, companyId: string | null): void {
    savePersistedContext(userId, {
      tenantId,
      scopeLevel,
      groupId,
      companyId,
      savedAt: Date.now(),
    });
  },

  /**
   * Clear persisted context for a user (e.g., on sign-out).
   */
  clearPersisted(userId: string): void {
    clearPersistedContext(userId);
  },

  // ════════════════════════════════════
  // PRIVATE
  // ════════════════════════════════════

  /**
   * Match a subdomain slug to a TenantScope.
   * Matches by:
   *   1. tenantName (lowercased, hyphenated) === slug
   *   2. tenantId starts with slug (for UUID-based subdomains)
   */
  _matchTenantBySlug(
    tenantScopes: ReadonlyArray<TenantScope>,
    slug: string,
  ): TenantScope | null {
    const normalized = slug.toLowerCase().trim();

    // Match by name (slugified)
    for (const t of tenantScopes) {
      const nameSlug = t.tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (nameSlug === normalized) return t;
    }

    // Match by ID prefix (for UUID-based subdomains like "abc123.domain.com")
    for (const t of tenantScopes) {
      if (t.tenantId.startsWith(normalized)) return t;
    }

    return null;
  },
};
