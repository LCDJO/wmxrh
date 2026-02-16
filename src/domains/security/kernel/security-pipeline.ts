/**
 * SecurityKernel — Middleware Pipeline
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  REQUEST PIPELINE (executes in order, short-circuits on deny):  ║
 * ║                                                                  ║
 * ║  1. RequestId        → generate unique request identifier       ║
 * ║  2. IdentityService  → validate auth, build Identity            ║
 * ║  3. ScopeResolver    → resolve effective scope from context     ║
 * ║  4. PermissionEngine → RBAC + ABAC check                       ║
 * ║  5. PolicyEngine     → declarative rule evaluation              ║
 * ║  6. AuditSecurity    → log result (allow or deny)               ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Domain services (HR, Compensation) call executepipeline() instead
 * of checking roles directly.
 */

import type { SecurityContext } from './identity.service';
import type { ResourceTarget, PermissionResult } from './permission-engine';
import type { PolicyResult } from './policy-engine';
import type { PermissionAction, PermissionEntity } from '../permissions';
import { checkPermission } from './permission-engine';
import { policyEngine } from './policy-engine';
import { auditSecurity } from './audit-security.service';

// ════════════════════════════════════
// PIPELINE TYPES
// ════════════════════════════════════

export type PipelineDecision = 'allow' | 'deny';

export interface PipelineResult {
  decision: PipelineDecision;
  /** Which stage denied (if any) */
  deniedBy?: 'auth' | 'permission' | 'policy';
  reason?: string;
  /** Permission engine result */
  permissionResult?: PermissionResult;
  /** Policy engine result */
  policyResult?: PolicyResult;
  /** Request ID for tracing */
  requestId: string;
}

export interface PipelineInput {
  /** The action being attempted */
  action: PermissionAction;
  /** The resource being accessed */
  resource: PermissionEntity;
  /** The authenticated SecurityContext (null = unauthenticated) */
  ctx: SecurityContext | null;
  /** Optional target entity for ABAC scope matching */
  target?: ResourceTarget;
  /** Skip policy evaluation (for read-only queries where RBAC suffices) */
  skipPolicy?: boolean;
  /** Skip audit logging (for high-frequency reads) */
  skipAudit?: boolean;
}

// ════════════════════════════════════
// PIPELINE EXECUTION
// ════════════════════════════════════

/**
 * Execute the full security pipeline.
 * 
 * Usage:
 *   const result = executeSecurityPipeline({
 *     action: 'create',
 *     resource: 'employees',
 *     ctx: securityContext,
 *     target: { company_id: employee.company_id },
 *   });
 *   if (result.decision === 'deny') throw new SecurityError(result.reason);
 */
export function executeSecurityPipeline(input: PipelineInput): PipelineResult {
  const { action, resource, ctx, target, skipPolicy = false, skipAudit = false } = input;
  const requestId = ctx?.request_id || `anon-${Date.now().toString(36)}`;

  // ── Stage 1+2: Identity check ──
  if (!ctx) {
    const result: PipelineResult = {
      decision: 'deny',
      deniedBy: 'auth',
      reason: 'Usuário não autenticado.',
      requestId,
    };
    if (!skipAudit) {
      auditSecurity.logAccessDenied({
        resource: `${resource}:${action}`,
        reason: result.reason!,
      });
    }
    return result;
  }

  // ── Stage 3: Scope is already resolved in SecurityContext ──
  // (ScopeResolver ran during buildSecurityContext)

  // ── Stage 4: Permission Engine (RBAC + ABAC) ──
  const permResult = checkPermission(action, resource, ctx, target);
  if (permResult.decision === 'deny') {
    const result: PipelineResult = {
      decision: 'deny',
      deniedBy: 'permission',
      reason: permResult.reason || `Permissão negada: ${action} em ${resource}.`,
      permissionResult: permResult,
      requestId,
    };
    if (!skipAudit) {
      auditSecurity.logAccessDenied({
        resource: `${resource}:${action}`,
        reason: result.reason!,
        ctx,
        metadata: { failedCheck: permResult.failedCheck, target },
      });
    }
    return result;
  }

  // ── Stage 5: Policy Engine (declarative rules) ──
  if (!skipPolicy) {
    const policyResult = policyEngine.evaluateRules({
      securityContext: ctx,
      action,
      resource,
      target: target ? {
        tenant_id: ctx.tenant_id,
        company_group_id: target.company_group_id,
        company_id: target.company_id,
      } : undefined,
    });

    if (policyResult.decision === 'deny') {
      const result: PipelineResult = {
        decision: 'deny',
        deniedBy: 'policy',
        reason: policyResult.reason || `Policy negou: ${action} em ${resource}.`,
        policyResult,
        requestId,
      };
      if (!skipAudit) {
        auditSecurity.logPolicyViolation({
          resource: `${resource}:${action}`,
          reason: result.reason!,
          policyId: policyResult.policyId,
          ctx,
          metadata: { evaluatedRules: policyResult.evaluatedRules, target },
        });
      }
      return result;
    }
  }

  // ── Stage 6: Audit (success) ──
  if (!skipAudit) {
    auditSecurity.logAccessAllowed({
      resource: `${resource}:${action}`,
      action,
      ctx,
      metadata: { target },
    });
  }

  return {
    decision: 'allow',
    requestId,
    permissionResult: permResult,
  };
}

/**
 * Execute pipeline and throw if denied.
 * Convenience for mutation guards.
 */
export function requirePermission(input: PipelineInput): void {
  const result = executeSecurityPipeline(input);
  if (result.decision === 'deny') {
    throw new SecurityPipelineError(result);
  }
}

// ════════════════════════════════════
// ERROR
// ════════════════════════════════════

export class SecurityPipelineError extends Error {
  public result: PipelineResult;

  constructor(result: PipelineResult) {
    super(result.reason || 'Acesso negado.');
    this.name = 'SecurityPipelineError';
    this.result = result;
  }
}
