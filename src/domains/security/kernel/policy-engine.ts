/**
 * SecurityKernel — PolicyEngine
 * 
 * Evaluates dynamic, composable policies at runtime.
 * Policies are pure functions: (context) => Decision.
 * 
 * This enables rules that go beyond static role checks:
 *   - Time-based restrictions
 *   - Scope-aware conditions
 *   - Feature-flag gated policies
 *   - Attribute-based access control (ABAC)
 */

import type { TenantRole } from '@/domains/shared/types';
import type { ScopeResolution } from './scope-resolver';

// ════════════════════════════════════
// POLICY TYPES
// ════════════════════════════════════

export type PolicyDecision = 'allow' | 'deny';

export interface PolicyContext {
  userId: string;
  tenantId: string;
  roles: TenantRole[];
  scope: ScopeResolution;
  /** Additional attributes for ABAC */
  attributes?: Record<string, unknown>;
}

export interface PolicyResult {
  decision: PolicyDecision;
  reason?: string;
  /** Policy that produced this result */
  policyId: string;
}

export type PolicyFn = (ctx: PolicyContext) => PolicyResult;

// ════════════════════════════════════
// BUILT-IN POLICIES
// ════════════════════════════════════

/** Deny if user has no roles at all (orphan membership) */
export const requireAtLeastOneRole: PolicyFn = (ctx) => ({
  decision: ctx.roles.length > 0 ? 'allow' : 'deny',
  reason: ctx.roles.length > 0 ? undefined : 'Nenhuma role atribuída ao usuário.',
  policyId: 'require_at_least_one_role',
});

/** Deny if scope resolution failed (no tenant) */
export const requireValidScope: PolicyFn = (ctx) => ({
  decision: ctx.scope.tenantId ? 'allow' : 'deny',
  reason: ctx.scope.tenantId ? undefined : 'Escopo do tenant não resolvido.',
  policyId: 'require_valid_scope',
});

/** Deny if trying to access cross-tenant resource */
export const preventCrossTenantAccess: PolicyFn = (ctx) => ({
  decision: ctx.tenantId === ctx.scope.tenantId ? 'allow' : 'deny',
  reason: ctx.tenantId === ctx.scope.tenantId
    ? undefined
    : 'Acesso cross-tenant bloqueado.',
  policyId: 'prevent_cross_tenant',
});

// ════════════════════════════════════
// POLICY ENGINE
// ════════════════════════════════════

export interface PolicyEngineAPI {
  /** Evaluate all registered policies. First 'deny' wins. */
  evaluate: (ctx: PolicyContext) => PolicyResult;
  /** Register a custom policy */
  register: (policy: PolicyFn) => void;
  /** Get all registered policies */
  getPolicies: () => PolicyFn[];
  /** Reset to default policies only */
  reset: () => void;
}

function createPolicyEngine(): PolicyEngineAPI {
  let policies: PolicyFn[] = [
    requireAtLeastOneRole,
    requireValidScope,
    preventCrossTenantAccess,
  ];

  return {
    evaluate: (ctx) => {
      for (const policy of policies) {
        const result = policy(ctx);
        if (result.decision === 'deny') return result;
      }
      return { decision: 'allow', policyId: 'all_passed' };
    },

    register: (policy) => {
      policies.push(policy);
    },

    getPolicies: () => [...policies],

    reset: () => {
      policies = [
        requireAtLeastOneRole,
        requireValidScope,
        preventCrossTenantAccess,
      ];
    },
  };
}

export const policyEngine = createPolicyEngine();
