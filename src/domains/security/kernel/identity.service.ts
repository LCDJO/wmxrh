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
import type { SecurityFeatureKey } from '../feature-flags';

// ════════════════════════════════════
// SECURITY CONTEXT — the universal auth envelope
// ════════════════════════════════════

export interface SecurityContext {
  /** Unique request/operation identifier */
  request_id: string;
  /** Authenticated user ID (from JWT sub) */
  user_id: string;
  /** Current tenant ID */
  tenant_id: string;
  /** User's hierarchical scopes */
  scopes: SecurityScope[];
  /** User's effective roles (merged membership + user_roles) */
  roles: TenantRole[];
  /** Active feature flags for this context */
  features: SecurityFeatureKey[];
  /** Additional identity metadata */
  meta: {
    email: string | null;
    session_id: string | null;
    /** Scope resolution result for query builders */
    scopeResolution: ScopeResolution;
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
  const hasTenantScope = scopes.some(s => s.type === 'tenant');
  if (!hasTenantScope && scopeResolution.hasTenantScope) {
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

  return {
    request_id: generateRequestId(),
    user_id: input.user.id,
    tenant_id: input.tenantId,
    scopes,
    roles: input.effectiveRoles,
    features,
    meta: {
      email: input.user.email ?? null,
      session_id: input.session.access_token?.slice(-8) ?? null,
      scopeResolution,
    },
  };
}
