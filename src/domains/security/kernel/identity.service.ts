/**
 * SecurityKernel — IdentityService
 * 
 * Resolves the current user's identity and builds a SecurityContext.
 * SecurityContext is the SINGLE object that travels through every layer.
 * 
 * Sources:
 *   Frontend: AuthContext + ScopeContext + TenantContext + FeatureFlags
 *   Backend:  JWT claims (custom_access_token_hook injects tenant_id, roles, scopes)
 */

import type { User, Session } from '@supabase/supabase-js';
import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import { resolveScope, type ScopeResolution } from './scope-resolver';
import { featureFlagEngine } from './feature-flag-engine';
import { getAccessGraph } from './access-graph';
import { dualIdentityEngine } from './dual-identity-engine';
import type { RealIdentity, ActiveIdentity } from './dual-identity-engine.types';
import type { SecurityFeatureKey, FeatureKey } from '../feature-flags';

// ════════════════════════════════════
// SECURITY CONTEXT — the universal auth envelope
// ════════════════════════════════════

export type UserType = 'platform' | 'tenant';

export interface SecurityContext {
  /** Unique request/operation identifier */
  request_id: string;
  /** Whether this is a platform admin or a tenant user */
  user_type: UserType;
  /** Authenticated user ID (from JWT sub) */
  user_id: string;
  /** Current tenant ID (null for platform users without tenant context) */
  tenant_id: string;
  /** User's hierarchical scopes */
  scopes: SecurityScope[];
  /** User's effective roles (merged membership + user_roles) */
  roles: TenantRole[];
  /** Active feature flags for this context */
  features: FeatureKey[];

  // ── QUERY OPTIMIZATION (from AccessGraph) ──
  /** Precomputed list of company IDs the user can access (for WHERE IN clauses) */
  allowed_company_ids: string[];
  /** Precomputed list of group IDs the user can access (for WHERE IN clauses) */
  allowed_group_ids: string[];

  // ── DUAL IDENTITY (impersonation awareness) ──
  /** The real identity — WHO is actually logged in (immutable) */
  real_identity: RealIdentity | null;
  /** The active identity — WHO is currently operating (may differ during impersonation) */
  active_identity: ActiveIdentity;
  /** Whether this context is operating under impersonation */
  is_impersonating: boolean;

  /** Additional identity metadata */
  meta: {
    email: string | null;
    session_id: string | null;
    /** Scope resolution result for query builders */
    scopeResolution: ScopeResolution;
    /** Whether user has full tenant-wide access (bypass company/group filters) */
    hasTenantScope: boolean;
  };
}

export interface SecurityScope {
  type: ScopeType;
  id: string | null;
}

// ════════════════════════════════════
// IDENTITY (lightweight, backward compat)
// ════════════════════════════════════

export interface Identity {
  userId: string;
  email: string | null;
  session: Session;
}

/**
 * Extract basic identity from auth state.
 * Returns null if not authenticated.
 */
export function resolveIdentity(
  user: User | null,
  session: Session | null
): Identity | null {
  if (!user || !session) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    session,
  };
}

// ════════════════════════════════════
// SECURITY CONTEXT BUILDER
// ════════════════════════════════════

let requestCounter = 0;

function generateRequestId(): string {
  requestCounter = (requestCounter + 1) % 1_000_000;
  const ts = Date.now().toString(36);
  const seq = requestCounter.toString(36).padStart(4, '0');
  return `fe-${ts}-${seq}`;
}

export interface BuildSecurityContextInput {
  user: User;
  session: Session;
  userType?: UserType;
  tenantId: string;
  effectiveRoles: TenantRole[];
  userRoles: UserRole[];
  membershipRole: TenantRole | null;
  uiScopeLevel: ScopeType;
  uiGroupId: string | null;
  uiCompanyId: string | null;
}

/**
 * Build a complete SecurityContext from frontend state.
 * This is called once per render cycle by useSecurityKernel.
 */
export function buildSecurityContext(input: BuildSecurityContextInput): SecurityContext {
  const scopeResolution = resolveScope({
    tenantId: input.tenantId,
    userRoles: input.userRoles,
    membershipRole: input.membershipRole,
    uiScopeLevel: input.uiScopeLevel,
    uiGroupId: input.uiGroupId,
    uiCompanyId: input.uiCompanyId,
  });

  // Build scopes array from user_roles
  const scopes: SecurityScope[] = input.userRoles.map(r => ({
    type: r.scope_type as ScopeType,
    id: r.scope_id,
  }));

  // If user has tenant-wide access via membership, ensure tenant scope is present
  const hasTenantScope = scopes.some(s => s.type === 'tenant') || scopeResolution.hasTenantScope;
  if (!scopes.some(s => s.type === 'tenant') && scopeResolution.hasTenantScope) {
    scopes.unshift({ type: 'tenant', id: null });
  }

  // Resolve active features
  const allFeatures: SecurityFeatureKey[] = ['MFA', 'SSO', 'LGPD', 'DATA_MASKING'];
  const features = allFeatures.filter(f =>
    featureFlagEngine.isEnabled(f, {
      tenantId: input.tenantId,
      roles: input.effectiveRoles,
    })
  );

  // Resolve allowed IDs from AccessGraph
  const graph = getAccessGraph();

  let allowed_company_ids: string[] = [];
  let allowed_group_ids: string[] = [];

  if (graph) {
    allowed_company_ids = Array.from(graph.getReachableCompanies());
    allowed_group_ids = Array.from(graph.getReachableGroups());
  }

  // ── Dual Identity resolution ──
  const realIdentity = dualIdentityEngine.realIdentity;
  const activeIdentity = dualIdentityEngine.activeIdentity;
  const isImpersonating = dualIdentityEngine.isImpersonating;

  // If impersonating, override tenant_id and user_type from ActiveIdentity
  const effectiveTenantId = isImpersonating && activeIdentity.tenantId
    ? activeIdentity.tenantId
    : input.tenantId;
  const effectiveUserType = isImpersonating
    ? activeIdentity.userType
    : (input.userType ?? 'tenant');

  return {
    request_id: generateRequestId(),
    user_type: effectiveUserType,
    user_id: input.user.id,
    tenant_id: effectiveTenantId,
    scopes,
    roles: input.effectiveRoles,
    features,
    allowed_company_ids,
    allowed_group_ids,
    real_identity: realIdentity,
    active_identity: activeIdentity,
    is_impersonating: isImpersonating,
    meta: {
      email: input.user.email ?? null,
      session_id: input.session.access_token?.slice(-8) ?? null,
      scopeResolution,
      hasTenantScope,
    },
  };
}
