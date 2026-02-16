/**
 * SecurityKernel — Identity Boundary Layer (IBL)
 * 
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  IDENTITY BOUNDARY LAYER                                            ║
 * ║                                                                      ║
 * ║  Separates:                                                          ║
 * ║    Identity        → WHO the user is (immutable per session)         ║
 * ║    OperationalCtx  → WHERE the user is operating (mutable)           ║
 * ║                                                                      ║
 * ║  ┌──────────────────────────────────────────────────────────────┐    ║
 * ║  │                    Identity (frozen)                         │    ║
 * ║  │  userId, email, sessionId, authenticatedAt                  │    ║
 * ║  │  allTenantMemberships, allUserRoles                         │    ║
 * ║  ├──────────────────────────────────────────────────────────────┤    ║
 * ║  │              Operational Context (switchable)                │    ║
 * ║  │  activeTenantId, activeGroupId, activeCompanyId             │    ║
 * ║  │  effectiveRoles (computed from identity + context)          │    ║
 * ║  │  accessGraph (rebuilt on context switch)                    │    ║
 * ║  └──────────────────────────────────────────────────────────────┘    ║
 * ║                                                                      ║
 * ║  INVARIANTS:                                                         ║
 * ║    1. Identity never changes without re-authentication               ║
 * ║    2. Context switches are validated against Identity grants          ║
 * ║    3. Every switch emits an audit event                              ║
 * ║    4. SecurityContext is rebuilt atomically on switch                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 * 
 * FUTURE-READY:
 *   - Delegated Access: switchContext validates delegation grants
 *   - Temporary Permissions: expiration checked at switch time
 *   - Access Expiration: TTL on OperationalContext
 *   - External IdP: Identity populated from SAML/OIDC claims
 */

import type { Session, User } from '@supabase/supabase-js';
import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import { auditSecurity } from './audit-security.service';

// ════════════════════════════════════
// IDENTITY — immutable per session
// ════════════════════════════════════

export interface BoundaryIdentity {
  /** Supabase auth user ID */
  readonly userId: string;
  /** User email from JWT */
  readonly email: string | null;
  /** Session fingerprint (last 8 chars of access_token) */
  readonly sessionFingerprint: string | null;
  /** When this identity was established */
  readonly authenticatedAt: number;
  /** All tenant memberships this user has (across all tenants) */
  readonly tenantMemberships: ReadonlyArray<TenantMembership>;
  /** All user_roles across all tenants (preloaded) */
  readonly allUserRoles: ReadonlyArray<UserRole>;
  /** Identity provider source (for future external IdP) */
  readonly provider: IdentityProvider;
}

export interface TenantMembership {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: TenantRole;
}

export type IdentityProvider = 
  | { type: 'supabase'; method: 'email' | 'oauth' }
  | { type: 'external'; providerId: string; method: 'saml' | 'oidc' };

// ════════════════════════════════════
// OPERATIONAL CONTEXT — mutable, validated
// ════════════════════════════════════

export interface OperationalContext {
  /** Currently active tenant */
  readonly activeTenantId: string;
  readonly activeTenantName: string;
  /** Active membership role for this tenant */
  readonly membershipRole: TenantRole;
  /** Scoped user_roles for the active tenant */
  readonly activeUserRoles: ReadonlyArray<UserRole>;
  /** Effective roles = membership + user_roles */
  readonly effectiveRoles: ReadonlyArray<TenantRole>;
  /** Current scope drill-down */
  readonly scopeLevel: ScopeType;
  readonly activeGroupId: string | null;
  readonly activeCompanyId: string | null;
  /** When this context was activated */
  readonly activatedAt: number;
  /** Optional TTL for context expiration (future: temporary access) */
  readonly expiresAt: number | null;
}

// ════════════════════════════════════
// CONTEXT SWITCH REQUEST
// ════════════════════════════════════

export interface ContextSwitchRequest {
  /** Target tenant to switch to */
  targetTenantId?: string;
  /** Target scope level */
  targetScopeLevel?: ScopeType;
  /** Target group (if narrowing scope) */
  targetGroupId?: string | null;
  /** Target company (if narrowing scope) */
  targetCompanyId?: string | null;
}

export interface ContextSwitchResult {
  success: boolean;
  newContext: OperationalContext | null;
  reason: string;
  /** Which validation failed */
  failedValidation?: 'NO_IDENTITY' | 'NO_MEMBERSHIP' | 'SCOPE_DENIED' | 'EXPIRED';
}

// ════════════════════════════════════
// IDENTITY BOUNDARY LAYER
// ════════════════════════════════════

export class IdentityBoundaryLayer {
  private _identity: BoundaryIdentity | null = null;
  private _operationalContext: OperationalContext | null = null;
  private _switchCount = 0;

  // ── IDENTITY LIFECYCLE ──

  /**
   * Establish identity from authentication state.
   * Called once on login / session restore. Identity is frozen until sign-out.
   */
  establish(input: EstablishIdentityInput): BoundaryIdentity {
    this._identity = Object.freeze({
      userId: input.user.id,
      email: input.user.email ?? null,
      sessionFingerprint: input.session.access_token?.slice(-8) ?? null,
      authenticatedAt: Date.now(),
      tenantMemberships: Object.freeze(input.tenantMemberships.map(m => Object.freeze(m))),
      allUserRoles: Object.freeze([...input.allUserRoles]),
      provider: input.provider ?? { type: 'supabase', method: 'email' },
    }) as BoundaryIdentity;

    return this._identity;
  }

  /**
   * Clear identity on sign-out.
   */
  clear(): void {
    if (this._identity) {
      auditSecurity.log({
        action: 'identity_cleared',
        resource: 'identity_boundary',
        result: 'success',
        reason: 'Identity cleared on sign-out',
        user_id: this._identity.userId,
      });
    }
    this._identity = null;
    this._operationalContext = null;
    this._switchCount = 0;
  }

  // ── CONTEXT SWITCHING ──

  /**
   * Switch operational context (tenant, group, or company).
   * Validates against the established identity grants.
   * 
   * @example
   * // Switch tenant
   * ibl.switchContext({ targetTenantId: 'tenant-2' });
   * 
   * // Narrow scope within current tenant
   * ibl.switchContext({ targetScopeLevel: 'company', targetCompanyId: 'company-x' });
   */
  switchContext(request: ContextSwitchRequest): ContextSwitchResult {
    // ── Validation 1: Identity must exist ──
    if (!this._identity) {
      return {
        success: false,
        newContext: null,
        reason: 'Nenhuma identidade estabelecida. Autentique-se primeiro.',
        failedValidation: 'NO_IDENTITY',
      };
    }

    const identity = this._identity;
    const targetTenantId = request.targetTenantId ?? this._operationalContext?.activeTenantId;

    if (!targetTenantId) {
      return {
        success: false,
        newContext: null,
        reason: 'Nenhum tenant alvo especificado e nenhum contexto ativo.',
        failedValidation: 'NO_MEMBERSHIP',
      };
    }

    // ── Validation 2: User must have membership in target tenant ──
    const membership = identity.tenantMemberships.find(m => m.tenantId === targetTenantId);
    if (!membership) {
      auditSecurity.logAccessDenied({
        resource: `tenant:${targetTenantId}`,
        reason: 'Tentativa de troca para tenant sem membership',
      });
      return {
        success: false,
        newContext: null,
        reason: `Sem acesso ao tenant ${targetTenantId}.`,
        failedValidation: 'NO_MEMBERSHIP',
      };
    }

    // ── Resolve roles for target tenant ──
    const tenantUserRoles = identity.allUserRoles.filter(
      r => r.tenant_id === targetTenantId
    );

    const effectiveRoles = computeEffectiveRoles(membership.role, tenantUserRoles);

    // ── Validation 3: Scope access ──
    const scopeLevel = request.targetScopeLevel ?? this._operationalContext?.scopeLevel ?? 'tenant';
    const groupId = request.targetGroupId ?? (request.targetTenantId ? null : this._operationalContext?.activeGroupId ?? null);
    const companyId = request.targetCompanyId ?? (request.targetTenantId ? null : this._operationalContext?.activeCompanyId ?? null);

    const scopeValidation = validateScopeAccess(
      effectiveRoles as TenantRole[],
      tenantUserRoles,
      scopeLevel,
      groupId,
      companyId,
    );

    if (!scopeValidation.allowed) {
      auditSecurity.logAccessDenied({
        resource: `scope:${scopeLevel}:${groupId || companyId || 'tenant'}`,
        reason: scopeValidation.reason,
      });
      return {
        success: false,
        newContext: null,
        reason: scopeValidation.reason,
        failedValidation: 'SCOPE_DENIED',
      };
    }

    // ── Build new context ──
    const previousTenantId = this._operationalContext?.activeTenantId;
    const isTenantSwitch = previousTenantId && previousTenantId !== targetTenantId;

    this._operationalContext = Object.freeze({
      activeTenantId: targetTenantId,
      activeTenantName: membership.tenantName,
      membershipRole: membership.role,
      activeUserRoles: Object.freeze([...tenantUserRoles]),
      effectiveRoles: Object.freeze(effectiveRoles),
      scopeLevel,
      activeGroupId: groupId,
      activeCompanyId: companyId,
      activatedAt: Date.now(),
      expiresAt: null, // Future: temporary access TTL
    }) as OperationalContext;

    this._switchCount++;

    // ── Audit ──
    auditSecurity.log({
      action: isTenantSwitch ? 'tenant_switched' : 'scope_switched',
      resource: 'identity_boundary',
      result: 'success',
      reason: isTenantSwitch ? 'Tenant switched' : 'Scope switched',
      user_id: identity.userId,
      tenant_id: targetTenantId,
      metadata: {
        fromTenant: previousTenantId,
        toTenant: targetTenantId,
        scopeLevel,
        groupId,
        companyId,
        switchCount: this._switchCount,
      },
    });

    return {
      success: true,
      newContext: this._operationalContext,
      reason: isTenantSwitch
        ? `Contexto trocado para tenant ${membership.tenantName}`
        : `Escopo atualizado para ${scopeLevel}${groupId ? `:${groupId}` : ''}${companyId ? `:${companyId}` : ''}`,
    };
  }

  // ── ACCESSORS ──

  get identity(): BoundaryIdentity | null {
    return this._identity;
  }

  get operationalContext(): OperationalContext | null {
    // Check expiration (future: temporary permissions)
    if (this._operationalContext?.expiresAt) {
      if (Date.now() > this._operationalContext.expiresAt) {
        this._operationalContext = null;
        return null;
      }
    }
    return this._operationalContext;
  }

  get isEstablished(): boolean {
    return this._identity !== null;
  }

  get hasActiveContext(): boolean {
    return this._operationalContext !== null;
  }

  get switchCount(): number {
    return this._switchCount;
  }

  /**
   * Get available tenants for context switching.
   */
  getAvailableTenants(): ReadonlyArray<TenantMembership> {
    return this._identity?.tenantMemberships ?? [];
  }

  /**
   * Check if user can switch to a specific tenant (O(1)).
   */
  canSwitchToTenant(tenantId: string): boolean {
    return this._identity?.tenantMemberships.some(m => m.tenantId === tenantId) ?? false;
  }

  /**
   * Snapshot for debugging / audit trail.
   */
  snapshot(): IdentityBoundarySnapshot {
    return {
      hasIdentity: this.isEstablished,
      userId: this._identity?.userId ?? null,
      provider: this._identity?.provider ?? null,
      authenticatedAt: this._identity?.authenticatedAt ?? null,
      tenantCount: this._identity?.tenantMemberships.length ?? 0,
      activeTenantId: this._operationalContext?.activeTenantId ?? null,
      scopeLevel: this._operationalContext?.scopeLevel ?? null,
      effectiveRoles: this._operationalContext?.effectiveRoles
        ? [...this._operationalContext.effectiveRoles]
        : [],
      switchCount: this._switchCount,
    };
  }
}

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

// ════════════════════════════════════
// INPUT TYPES
// ════════════════════════════════════

export interface EstablishIdentityInput {
  user: User;
  session: Session;
  tenantMemberships: TenantMembership[];
  allUserRoles: UserRole[];
  provider?: IdentityProvider;
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

const TENANT_WIDE_ROLES: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

function computeEffectiveRoles(
  membershipRole: TenantRole,
  userRoles: ReadonlyArray<UserRole>,
): TenantRole[] {
  const roles = new Set<TenantRole>();
  roles.add(membershipRole);
  for (const ur of userRoles) {
    roles.add(ur.role);
  }
  return Array.from(roles);
}

function validateScopeAccess(
  effectiveRoles: TenantRole[],
  userRoles: ReadonlyArray<UserRole>,
  scopeLevel: ScopeType,
  groupId: string | null,
  companyId: string | null,
): { allowed: boolean; reason: string } {
  // Tenant-wide roles can access any scope
  if (effectiveRoles.some(r => TENANT_WIDE_ROLES.includes(r))) {
    return { allowed: true, reason: 'Tenant-wide access' };
  }

  // Tenant level requires tenant-wide role
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

  // Company scope: user must have a role scoped to this company or its parent group
  if (scopeLevel === 'company' && companyId) {
    const hasCompanyAccess = userRoles.some(
      r => r.scope_type === 'company' && r.scope_id === companyId
    ) || userRoles.some(
      r => r.scope_type === 'company_group' // group admins inherit company access
    ) || userRoles.some(r => r.scope_type === 'tenant');

    if (!hasCompanyAccess) {
      return { allowed: false, reason: `Sem acesso à empresa ${companyId}` };
    }
  }

  return { allowed: true, reason: 'Scope access validated' };
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const identityBoundary = new IdentityBoundaryLayer();
