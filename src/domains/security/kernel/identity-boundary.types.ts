/**
 * Identity Boundary Layer — Shared Type Definitions
 * 
 * Extracted from identity-boundary.ts to break circular dependencies.
 * All IBL components and the main compositor import types from here.
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';

// ════════════════════════════════════
// IDENTITY SESSION — immutable per auth session
// ════════════════════════════════════

export interface IdentitySession {
  readonly userId: string;
  readonly email: string | null;
  readonly sessionFingerprint: string | null;
  readonly authenticatedAt: number;
  readonly tenantScopes: ReadonlyArray<TenantScope>;
  readonly allUserRoles: ReadonlyArray<UserRole>;
  readonly provider: IdentityProvider;
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
  activeTenantId: string | null;
  scopeLevel: ScopeType | null;
  effectiveRoles: TenantRole[];
  switchCount: number;
}
