/**
 * Identity Boundary Layer — Shared Type Definitions
 * 
 * Extracted from identity-boundary.ts to break circular dependencies.
 * All IBL components and the main compositor import types from here.
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import type { FeatureKey } from '../feature-flags';

// ════════════════════════════════════
// IDENTITY SESSION — immutable per auth session
// ════════════════════════════════════

export interface IdentitySession {
  readonly userId: string;
  readonly email: string | null;
  readonly sessionFingerprint: string | null;
  readonly authenticatedAt: number;

  /** All tenants the user has membership in */
  readonly tenantScopes: ReadonlyArray<TenantScope>;
  /** All user_roles across tenants */
  readonly allUserRoles: ReadonlyArray<UserRole>;
  /** Auth provider info */
  readonly provider: IdentityProvider;

  /** Precomputed tenant IDs for quick lookup */
  readonly tenantIds: ReadonlyArray<string>;
  /** Merged roles across all scopes */
  readonly roles: ReadonlyArray<TenantRole>;
  /** AccessGraph snapshot reference (graph version + precomputed sets) */
  readonly accessGraphSnapshot: AccessGraphSnapshot | null;
  /** Active feature flags resolved at session establishment */
  readonly featureFlags: ReadonlyArray<FeatureKey>;
  /** Precomputed allowed scopes from AccessGraph */
  readonly allowedScopes: AllowedScopes;
}

/**
 * Lightweight snapshot of the AccessGraph state at session time.
 * Avoids coupling IdentitySession to the full AccessGraph class.
 */
export interface AccessGraphSnapshot {
  readonly version: number;
  readonly builtAt: number;
  readonly hasTenantScope: boolean;
  readonly reachableGroupIds: ReadonlyArray<string>;
  readonly reachableCompanyIds: ReadonlyArray<string>;
}

/**
 * Precomputed allowed scopes derived from AccessGraph + user_roles.
 * Used by query builders and guard middleware for O(1) checks.
 */
export interface AllowedScopes {
  readonly tenantIds: ReadonlyArray<string>;
  readonly groupIds: ReadonlyArray<string>;
  readonly companyIds: ReadonlyArray<string>;
  readonly hasTenantWideAccess: boolean;
}

export interface TenantScope {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: TenantRole;
}

/** @deprecated Use IdentitySession instead */
export type BoundaryIdentity = IdentitySession;
/** @deprecated Use TenantScope instead */
export type TenantMembership = TenantScope;

export type IdentityProvider = 
  | { type: 'supabase'; method: 'email' | 'oauth' }
  | { type: 'external'; providerId: string; method: 'saml' | 'oidc' };

// ════════════════════════════════════
// OPERATIONAL CONTEXT
// ════════════════════════════════════

export interface OperationalContext {
  readonly activeTenantId: string;
  readonly activeTenantName: string;
  readonly membershipRole: TenantRole;
  readonly activeUserRoles: ReadonlyArray<UserRole>;
  readonly effectiveRoles: ReadonlyArray<TenantRole>;
  readonly scopeLevel: ScopeType;
  readonly activeGroupId: string | null;
  readonly activeCompanyId: string | null;
  readonly activatedAt: number;
  readonly expiresAt: number | null;
}

// ════════════════════════════════════
// CONTEXT SWITCH
// ════════════════════════════════════

export interface ContextSwitchRequest {
  targetTenantId?: string;
  targetScopeLevel?: ScopeType;
  targetGroupId?: string | null;
  targetCompanyId?: string | null;
}

export interface ContextSwitchResult {
  success: boolean;
  newContext: OperationalContext | null;
  reason: string;
  failedValidation?: 'NO_IDENTITY' | 'NO_MEMBERSHIP' | 'SCOPE_DENIED' | 'EXPIRED';
}

// ════════════════════════════════════
// SNAPSHOT
// ════════════════════════════════════

export interface IdentityBoundarySnapshot {
  hasIdentity: boolean;
  userId: string | null;
  provider: IdentityProvider | null;
  authenticatedAt: number | null;
  tenantCount: number;
  tenantIds: string[];
  roles: TenantRole[];
  featureFlagCount: number;
  hasAccessGraph: boolean;
  allowedScopes: AllowedScopes | null;
  activeTenantId: string | null;
  scopeLevel: ScopeType | null;
  effectiveRoles: TenantRole[];
  switchCount: number;
}
