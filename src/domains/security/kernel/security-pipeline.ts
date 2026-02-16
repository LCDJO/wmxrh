/**
 * SecurityKernel — Middleware Pipeline (v2)
 * 
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  REQUEST PIPELINE (executes in order, short-circuits on deny):      ║
 * ║                                                                      ║
 * ║  1. RequestId               → generate unique request identifier    ║
 * ║  2. IdentityService         → validate auth, resolve Identity       ║
 * ║  3. IdentitySessionManager  → validate IBL session established      ║
 * ║  4. ContextResolver         → validate OperationalContext active    ║
 * ║  5. AccessGraph             → O(1) scope reachability check         ║
 * ║  6. PermissionEngine        → RBAC + ABAC check                     ║
 * ║  7. PolicyEngine            → declarative rule evaluation           ║
 * ║  8. AuditSecurity           → log result (allow or deny)            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 * 
 * Domain services (HR, Compensation) call executeSecurityPipeline()
 * instead of checking roles directly.
 */

import type { SecurityContext } from './identity.service';
import type { ResourceTarget, PermissionResult } from './permission-engine';
import type { PolicyResult } from './policy-engine';
import type { PermissionAction, PermissionEntity } from '../permissions';
import { checkPermission } from './permission-engine';
import { policyEngine } from './policy-engine';
import { auditSecurity } from './audit-security.service';
import { contextGuard } from './ibl/context-guard.middleware';
import type { GuardTarget } from './ibl/context-guard.middleware';
import { identityBoundary } from './identity-boundary';
import { getAccessGraph } from './access-graph';

// ════════════════════════════════════
// PIPELINE TYPES
// ════════════════════════════════════

export type PipelineDecision = 'allow' | 'deny';

export type PipelineDeniedBy =
  | 'auth'                    // Stage 2: no SecurityContext
  | 'identity_session'        // Stage 3: IBL session not established
  | 'context'                 // Stage 4: OperationalContext missing/expired
  | 'access_graph'            // Stage 5: scope unreachable in graph
  | 'permission'              // Stage 6: RBAC/ABAC denied
  | 'policy';                 // Stage 7: declarative rule denied

export interface PipelineResult {
  decision: PipelineDecision;
  /** Which stage denied (if any) */
  deniedBy?: PipelineDeniedBy;
  /** Stage number that denied (1-8) */
  deniedAtStage?: number;
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
  /** Optional guard target for IBL scope validation */
  guardTarget?: GuardTarget;
  /** Skip AccessGraph check (for operations where RBAC suffices) */
  skipAccessGraph?: boolean;
  /** Skip policy evaluation (for read-only queries where RBAC suffices) */
  skipPolicy?: boolean;
  /** Skip audit logging (for high-frequency reads) */
  skipAudit?: boolean;
}

// ════════════════════════════════════
// PIPELINE EXECUTION
// ════════════════════════════════════

/**
 * Execute the full 8-stage security pipeline.
 * 
 * Usage:
 *   const result = executeSecurityPipeline({
 *     action: 'create',
 *     resource: 'employees',
 *     ctx: securityContext,
 *     target: { company_id: employee.company_id },
 *     guardTarget: { tenantId, companyId: employee.company_id },
 *   });
 *   if (result.decision === 'deny') throw new SecurityError(result.reason);
 */
export function executeSecurityPipeline(input: PipelineInput): PipelineResult {
  const {
    action, resource, ctx, target, guardTarget,
    skipAccessGraph = false, skipPolicy = false, skipAudit = false,
  } = input;

  // ── Stage 1: RequestId ──
  const requestId = ctx?.request_id || `anon-${Date.now().toString(36)}`;

  // ── Stage 2: IdentityService — validate auth ──
  if (!ctx) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'auth',
      deniedAtStage: 2,
      reason: 'Usuário não autenticado.',
      requestId,
    }, resource, action, skipAudit);
  }

  // ── Stage 3: IdentitySessionManager — validate IBL session ──
  if (!identityBoundary.isEstablished) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'identity_session',
      deniedAtStage: 3,
      reason: 'Sessão de identidade não estabelecida no IBL.',
      requestId,
    }, resource, action, skipAudit, ctx);
  }

  // ── Stage 4: ContextResolver — validate OperationalContext ──
  const guardResult = contextGuard.validate(
    identityBoundary.identity,
    identityBoundary.operationalContext,
    guardTarget,
  );
  if (!guardResult.passed) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'context',
      deniedAtStage: 4,
      reason: guardResult.reason,
      requestId,
    }, resource, action, skipAudit, ctx);
  }

  // ── Stage 5: AccessGraph — O(1) scope reachability ──
  if (!skipAccessGraph && target) {
    const graph = getAccessGraph();
    if (graph) {
      const scopeReachable = checkAccessGraphReachability(graph, target);
      if (!scopeReachable) {
        return denyAndAudit({
          decision: 'deny',
          deniedBy: 'access_graph',
          deniedAtStage: 5,
          reason: `Escopo não alcançável no AccessGraph: company=${target.company_id ?? '?'}, group=${target.company_group_id ?? '?'}`,
          requestId,
        }, resource, action, skipAudit, ctx, { target });
      }
    }
  }

  // ── Stage 6: PermissionEngine (RBAC + ABAC) ──
  const permResult = checkPermission(action, resource, ctx, target);
  if (permResult.decision === 'deny') {
    const result: PipelineResult = {
      decision: 'deny',
      deniedBy: 'permission',
      deniedAtStage: 6,
      reason: permResult.reason || `Permissão negada: ${action} em ${resource}.`,
      permissionResult: permResult,
      requestId,
    };
    if (!skipAudit) {
      auditSecurity.logAccessDenied({
        resource: `${resource}:${action}`,
        reason: result.reason!,
        ctx,
        metadata: { failedCheck: permResult.failedCheck, target, stage: 6 },
      });
    }
    return result;
  }

  // ── Stage 7: PolicyEngine (declarative rules) ──
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
        deniedAtStage: 7,
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
          metadata: { evaluatedRules: policyResult.evaluatedRules, target, stage: 7 },
        });
      }
      return result;
    }
  }

  // ── Stage 8: AuditSecurity (success) ──
  if (!skipAudit) {
    auditSecurity.logAccessAllowed({
      resource: `${resource}:${action}`,
      action,
      ctx,
      metadata: { target, stagesCleared: 8 },
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
// HELPERS
// ════════════════════════════════════

function denyAndAudit(
  result: PipelineResult,
  resource: PermissionEntity,
  action: PermissionAction,
  skipAudit: boolean,
  ctx?: SecurityContext | null,
  metadata?: Record<string, unknown>,
): PipelineResult {
  if (!skipAudit) {
    auditSecurity.logAccessDenied({
      resource: `${resource}:${action}`,
      reason: result.reason!,
      ctx,
      metadata: { ...metadata, stage: result.deniedAtStage },
    });
  }
  return result;
}

function checkAccessGraphReachability(
  graph: ReturnType<typeof getAccessGraph>,
  target: ResourceTarget,
): boolean {
  if (!graph) return true; // No graph = skip check

  if (target.company_id) {
    if (!graph.canAccessScope('company', target.company_id)) return false;
  }
  if (target.company_group_id) {
    if (!graph.canAccessScope('company_group', target.company_group_id)) return false;
  }

  return true;
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
