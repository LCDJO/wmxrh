/**
 * IBL Component 1 — IdentitySessionManager
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Manages the IdentitySession lifecycle:                      ║
 * ║    establish()  → freeze identity on login/session restore   ║
 * ║    clear()      → wipe identity on sign-out                  ║
 * ║    refresh()    → update tenant scopes without re-auth       ║
 * ║                                                              ║
 * ║  NOW ALSO RESPONSIBLE FOR:                                    ║
 * ║    • Loading AccessGraph snapshot into the session            ║
 * ║    • Resolving FeatureFlags at session time                   ║
 * ║    • Precomputing allowed_scopes for O(1) query filters      ║
 * ║                                                              ║
 * ║  INVARIANT: IdentitySession is Object.freeze'd.              ║
 * ║  Only establish() and clear() can mutate the reference.      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { Session, User } from '@supabase/supabase-js';
import type { TenantRole, UserRole } from '@/domains/shared/types';
import { auditSecurity } from '../audit-security.service';
import { getAccessGraph } from '../access-graph';
import { featureFlagEngine } from '../feature-flag-engine';
import { emitIBLEvent } from './domain-events';
import type { SecurityFeatureKey, FeatureKey } from '../../feature-flags';
import type {
  IdentitySession,
  TenantScope,
  IdentityProvider,
  AccessGraphSnapshot,
  AllowedScopes,
} from '../identity-boundary.types';

// ════════════════════════════════════
// INPUT
// ════════════════════════════════════

export interface EstablishIdentityInput {
  user: User;
  session: Session;
  tenantMemberships: TenantScope[];
  allUserRoles: UserRole[];
  provider?: IdentityProvider;
}

export interface RefreshScopesInput {
  tenantMemberships: TenantScope[];
  allUserRoles: UserRole[];
}

// ════════════════════════════════════
// MANAGER
// ════════════════════════════════════

export class IdentitySessionManager {
  private _session: IdentitySession | null = null;

  /**
   * Establish identity from auth state.
   * Called once on login / session restore. Identity is frozen until sign-out.
   * 
   * Loads:
   *   - AccessGraph snapshot (precomputed group/company reachability)
   *   - FeatureFlags (resolved for primary tenant)
   *   - AllowedScopes (precomputed from AccessGraph + user_roles)
   */
  establish(input: EstablishIdentityInput): IdentitySession {
    const tenantIds = input.tenantMemberships.map(m => m.tenantId);
    const roles = this._mergeRoles(input.tenantMemberships, input.allUserRoles);
    const accessGraphSnapshot = this._captureAccessGraphSnapshot();
    const featureFlags = this._resolveFeatureFlags(tenantIds[0] ?? null, roles);
    const allowedScopes = this._computeAllowedScopes(
      tenantIds,
      input.allUserRoles,
      accessGraphSnapshot,
    );

    this._session = Object.freeze({
      userId: input.user.id,
      email: input.user.email ?? null,
      sessionFingerprint: input.session.access_token?.slice(-8) ?? null,
      authenticatedAt: Date.now(),
      tenantScopes: Object.freeze(input.tenantMemberships.map(m => Object.freeze(m))),
      allUserRoles: Object.freeze([...input.allUserRoles]),
      provider: input.provider ?? { type: 'supabase', method: 'email' },
      tenantIds: Object.freeze(tenantIds),
      roles: Object.freeze(roles),
      accessGraphSnapshot,
      featureFlags: Object.freeze(featureFlags),
      allowedScopes: Object.freeze(allowedScopes),
    }) as IdentitySession;

    // Emit IdentitySessionStarted event
    emitIBLEvent({
      type: 'IdentitySessionStarted',
      timestamp: Date.now(),
      userId: input.user.id,
      email: input.user.email ?? null,
      provider: this._session.provider,
      tenantCount: tenantIds.length,
      tenantIds: [...tenantIds],
      roles: [...roles],
      allowedScopes: { ...allowedScopes },
      hasAccessGraph: !!accessGraphSnapshot,
    });

    auditSecurity.log({
      action: 'identity_established',
      resource: 'identity_session_manager',
      result: 'success',
      reason: `Identity established for ${input.user.email ?? input.user.id}`,
      user_id: input.user.id,
      metadata: {
        tenantCount: tenantIds.length,
        roleCount: roles.length,
        featureFlagCount: featureFlags.length,
        hasAccessGraph: !!accessGraphSnapshot,
        allowedGroupCount: allowedScopes.groupIds.length,
        allowedCompanyCount: allowedScopes.companyIds.length,
      },
    });

    return this._session;
  }

  /**
   * Refresh tenant scopes, user roles, and recompute derived data
   * without re-establishing identity.
   * Preserves userId, email, sessionFingerprint, authenticatedAt, provider.
   */
  refresh(input: RefreshScopesInput): IdentitySession | null {
    if (!this._session) return null;

    const tenantIds = input.tenantMemberships.map(m => m.tenantId);
    const roles = this._mergeRoles(input.tenantMemberships, input.allUserRoles);
    const accessGraphSnapshot = this._captureAccessGraphSnapshot();
    const featureFlags = this._resolveFeatureFlags(tenantIds[0] ?? null, roles);
    const allowedScopes = this._computeAllowedScopes(
      tenantIds,
      input.allUserRoles,
      accessGraphSnapshot,
    );

    const previousRoles = this._session.roles;

    this._session = Object.freeze({
      ...this._session,
      tenantScopes: Object.freeze(input.tenantMemberships.map(m => Object.freeze(m))),
      allUserRoles: Object.freeze([...input.allUserRoles]),
      tenantIds: Object.freeze(tenantIds),
      roles: Object.freeze(roles),
      accessGraphSnapshot,
      featureFlags: Object.freeze(featureFlags),
      allowedScopes: Object.freeze(allowedScopes),
    }) as IdentitySession;

    // Emit IdentitySessionRefreshed event
    const addedRoles = roles.filter(r => !previousRoles.includes(r));
    const removedRoles = previousRoles.filter(r => !roles.includes(r));

    emitIBLEvent({
      type: 'IdentitySessionRefreshed',
      timestamp: Date.now(),
      userId: this._session.userId,
      tenantCount: tenantIds.length,
      roleCount: roles.length,
      addedRoles,
      removedRoles,
    });

    return this._session;
  }

  /**
   * Clear identity on sign-out.
   */
  clear(): void {
    if (this._session) {
      auditSecurity.log({
        action: 'identity_cleared',
        resource: 'identity_session_manager',
        result: 'success',
        reason: 'Identity cleared on sign-out',
        user_id: this._session.userId,
      });
    }
    this._session = null;
  }

  get session(): IdentitySession | null {
    return this._session;
  }

  get isEstablished(): boolean {
    return this._session !== null;
  }

  // ════════════════════════════════════
  // PRIVATE — AccessGraph
  // ════════════════════════════════════

  private _captureAccessGraphSnapshot(): AccessGraphSnapshot | null {
    const graph = getAccessGraph();
    if (!graph) return null;

    const stats = graph.getStats();
    return Object.freeze({
      version: stats.version,
      builtAt: stats.builtAt,
      hasTenantScope: stats.hasTenantScope,
      reachableGroupIds: Object.freeze(Array.from(graph.getReachableGroups())),
      reachableCompanyIds: Object.freeze(Array.from(graph.getReachableCompanies())),
    }) as AccessGraphSnapshot;
  }

  // ════════════════════════════════════
  // PRIVATE — FeatureFlags
  // ════════════════════════════════════

  private _resolveFeatureFlags(
    primaryTenantId: string | null,
    roles: TenantRole[],
  ): FeatureKey[] {
    if (!primaryTenantId) return [];

    const allFeatures: SecurityFeatureKey[] = ['MFA', 'SSO', 'LGPD', 'DATA_MASKING'];
    return allFeatures.filter(f =>
      featureFlagEngine.isEnabled(f, {
        tenantId: primaryTenantId,
        roles,
      })
    );
  }

  // ════════════════════════════════════
  // PRIVATE — AllowedScopes
  // ════════════════════════════════════

  private _computeAllowedScopes(
    tenantIds: string[],
    userRoles: UserRole[],
    graphSnapshot: AccessGraphSnapshot | null,
  ): AllowedScopes {
    const hasTenantWideAccess = graphSnapshot?.hasTenantScope ?? false;

    // If AccessGraph provides precomputed reachability, use it
    if (graphSnapshot) {
      return {
        tenantIds,
        groupIds: [...graphSnapshot.reachableGroupIds],
        companyIds: [...graphSnapshot.reachableCompanyIds],
        hasTenantWideAccess,
      };
    }

    // Fallback: derive from user_roles directly
    const groupIds = new Set<string>();
    const companyIds = new Set<string>();

    for (const r of userRoles) {
      if (r.scope_type === 'company_group' && r.scope_id) {
        groupIds.add(r.scope_id);
      }
      if (r.scope_type === 'company' && r.scope_id) {
        companyIds.add(r.scope_id);
      }
    }

    return {
      tenantIds,
      groupIds: Array.from(groupIds),
      companyIds: Array.from(companyIds),
      hasTenantWideAccess,
    };
  }

  // ════════════════════════════════════
  // PRIVATE — Role merging
  // ════════════════════════════════════

  private _mergeRoles(
    memberships: TenantScope[],
    userRoles: UserRole[],
  ): TenantRole[] {
    const roles = new Set<TenantRole>();
    for (const m of memberships) roles.add(m.role);
    for (const r of userRoles) roles.add(r.role);
    return Array.from(roles);
  }
}
