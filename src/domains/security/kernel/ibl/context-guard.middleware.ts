/**
 * IBL Component 5 — ContextGuardMiddleware
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Middleware that validates operational context before any     ║
 * ║  security-sensitive operation:                                ║
 * ║                                                              ║
 * ║    Guard Chain:                                               ║
 * ║      1. identityEstablished  → session exists?               ║
 * ║      2. contextActive        → operational context set?      ║
 * ║      3. contextNotExpired    → TTL still valid?              ║
 * ║      4. tenantMatch          → target matches active tenant? ║
 * ║      5. scopeContained       → target within user's scope?  ║
 * ║                                                              ║
 * ║  Consumed by: SecurityPipeline, SecureMutation, ScopedQuery  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { ScopeType } from '@/domains/shared/types';
import type {
  IdentitySession,
  OperationalContext,
} from '../identity-boundary.types';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export type GuardCheckName =
  | 'IDENTITY_ESTABLISHED'
  | 'CONTEXT_ACTIVE'
  | 'CONTEXT_NOT_EXPIRED'
  | 'TENANT_MATCH'
  | 'SCOPE_CONTAINED';

export interface GuardResult {
  passed: boolean;
  failedCheck?: GuardCheckName;
  reason: string;
}

export interface GuardTarget {
  /** Expected tenant ID */
  tenantId?: string;
  /** Expected group ID */
  groupId?: string | null;
  /** Expected company ID */
  companyId?: string | null;
  /** Expected scope type */
  scopeType?: ScopeType;
}

// ════════════════════════════════════
// MIDDLEWARE (stateless)
// ════════════════════════════════════

export const contextGuard = {
  /**
   * Run all guard checks in order. Short-circuits on first failure.
   */
  validate(
    identity: IdentitySession | null,
    context: OperationalContext | null,
    target?: GuardTarget,
  ): GuardResult {
    // 1. Identity must be established
    if (!identity) {
      return {
        passed: false,
        failedCheck: 'IDENTITY_ESTABLISHED',
        reason: 'Identidade não estabelecida.',
      };
    }

    // 2. Context must be active
    if (!context) {
      return {
        passed: false,
        failedCheck: 'CONTEXT_ACTIVE',
        reason: 'Contexto operacional não ativo.',
      };
    }

    // 3. Context must not be expired
    if (context.expiresAt && Date.now() > context.expiresAt) {
      return {
        passed: false,
        failedCheck: 'CONTEXT_NOT_EXPIRED',
        reason: 'Contexto operacional expirado.',
      };
    }

    // 4. Tenant must match (if target specifies one)
    if (target?.tenantId && target.tenantId !== context.activeTenantId) {
      return {
        passed: false,
        failedCheck: 'TENANT_MATCH',
        reason: `Tenant mismatch: ativo=${context.activeTenantId}, alvo=${target.tenantId}`,
      };
    }

    // 5. Scope must be contained
    if (target?.companyId || target?.groupId) {
      const scopeResult = checkScopeContainment(identity, context, target);
      if (!scopeResult.passed) return scopeResult;
    }

    return { passed: true, reason: 'Todos os guards passaram.' };
  },

  /**
   * Quick check: identity + context are ready for operations.
   */
  isReady(
    identity: IdentitySession | null,
    context: OperationalContext | null,
  ): boolean {
    if (!identity || !context) return false;
    if (context.expiresAt && Date.now() > context.expiresAt) return false;
    return true;
  },

  /**
   * Assert context is valid. Throws if any guard fails.
   */
  require(
    identity: IdentitySession | null,
    context: OperationalContext | null,
    target?: GuardTarget,
  ): void {
    const result = contextGuard.validate(identity, context, target);
    if (!result.passed) {
      throw new ContextGuardError(result);
    }
  },
};

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

const TENANT_WIDE_ROLES = new Set([
  'superadmin', 'owner', 'admin', 'tenant_admin',
]);

function checkScopeContainment(
  identity: IdentitySession,
  context: OperationalContext,
  target: GuardTarget,
): GuardResult {
  // Tenant-wide roles bypass scope checks
  if (context.effectiveRoles.some(r => TENANT_WIDE_ROLES.has(r))) {
    return { passed: true, reason: 'Tenant-wide access bypasses scope check.' };
  }

  const tenantUserRoles = identity.allUserRoles.filter(
    r => r.tenant_id === context.activeTenantId
  );

  // Check company access
  if (target.companyId) {
    const hasAccess = tenantUserRoles.some(
      r => r.scope_type === 'company' && r.scope_id === target.companyId
    ) || tenantUserRoles.some(
      r => r.scope_type === 'company_group'
    ) || tenantUserRoles.some(
      r => r.scope_type === 'tenant'
    );

    if (!hasAccess) {
      return {
        passed: false,
        failedCheck: 'SCOPE_CONTAINED',
        reason: `Sem acesso à empresa ${target.companyId}`,
      };
    }
  }

  // Check group access
  if (target.groupId) {
    const hasAccess = tenantUserRoles.some(
      r => r.scope_type === 'company_group' && r.scope_id === target.groupId
    ) || tenantUserRoles.some(
      r => r.scope_type === 'tenant'
    );

    if (!hasAccess) {
      return {
        passed: false,
        failedCheck: 'SCOPE_CONTAINED',
        reason: `Sem acesso ao grupo ${target.groupId}`,
      };
    }
  }

  return { passed: true, reason: 'Escopo contido nos grants do usuário.' };
}

// ════════════════════════════════════
// ERROR
// ════════════════════════════════════

export class ContextGuardError extends Error {
  public result: GuardResult;

  constructor(result: GuardResult) {
    super(result.reason);
    this.name = 'ContextGuardError';
    this.result = result;
  }
}
