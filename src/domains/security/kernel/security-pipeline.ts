/**
 * SecurityKernel — Middleware Pipeline (v3)
 * 
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  UNIFIED REQUEST PIPELINE — branches by user_type:                  ║
 * ║                                                                      ║
 * ║  1. RequestId               → generate unique request identifier    ║
 * ║  2. IdentityResolver        → validate auth (SecurityContext)       ║
 * ║  3. UserTypeResolver        → route to platform or tenant pipeline  ║
 * ║                                                                      ║
 * ║  ┌─ PLATFORM PATH (user_type === 'platform') ──────────────────┐   ║
 * ║  │  4P. PlatformPermissionGuard → check PlatformPermissionMatrix│   ║
 * ║  │  5P. AuditSecurity           → log result                   │   ║
 * ║  └─────────────────────────────────────────────────────────────┘   ║
 * ║                                                                      ║
 * ║  ┌─ TENANT PATH (user_type === 'tenant') ──────────────────────┐   ║
 * ║  │  4T. IdentitySessionManager  → validate IBL session          │   ║
 * ║  │  5T. ContextResolver         → validate OperationalContext   │   ║
 * ║  │  6T. AccessGraph             → O(1) scope reachability       │   ║
 * ║  │  7T. PermissionEngine        → RBAC + ABAC check             │   ║
 * ║  │  8T. PolicyEngine            → declarative rule evaluation   │   ║
 * ║  │  9T. AuditSecurity           → log result                   │   ║
 * ║  └─────────────────────────────────────────────────────────────┘   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
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
import { hasPlatformPermission, type PlatformPermission } from '@/domains/platform/platform-permissions';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';

// ════════════════════════════════════
// PIPELINE TYPES
// ════════════════════════════════════

export type PipelineDecision = 'allow' | 'deny';

export type PipelineDeniedBy =
  | 'auth'                    // Stage 2: no SecurityContext
  | 'identity_session'        // Stage 4T: IBL session not established
  | 'context'                 // Stage 5T: OperationalContext missing/expired
  | 'access_graph'            // Stage 6T: scope unreachable in graph
  | 'permission'              // Stage 7T / 4P: RBAC/ABAC or Platform denied
  | 'policy';                 // Stage 8T: declarative rule denied

export interface PipelineResult {
  decision: PipelineDecision;
  /** Which stage denied (if any) */
  deniedBy?: PipelineDeniedBy;
  /** Stage label that denied */
  deniedAtStage?: number | string;
  reason?: string;
  /** Permission engine result (tenant path) */
  permissionResult?: PermissionResult;
  /** Policy engine result (tenant path) */
  policyResult?: PolicyResult;
  /** Request ID for tracing */
  requestId: string;
  /** Which pipeline path was taken */
  path?: 'platform' | 'tenant';
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
  /** For platform path: the platform permission to check */
  platformPermission?: PlatformPermission;
  /** For platform path: the user's platform role */
  platformRole?: PlatformRoleType;
}

// ════════════════════════════════════
// PIPELINE EXECUTION
// ════════════════════════════════════

export function executeSecurityPipeline(input: PipelineInput): PipelineResult {
  const { ctx, skipAudit = false } = input;

  // ── Stage 1: RequestId ──
  const requestId = ctx?.request_id || `anon-${Date.now().toString(36)}`;

  // ── Stage 2: IdentityResolver — validate auth ──
  if (!ctx) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'auth',
      deniedAtStage: 2,
      reason: 'Usuário não autenticado.',
      requestId,
    }, input.resource, input.action, skipAudit);
  }

  // ── Stage 3: UserTypeResolver — branch ──
  if (ctx.user_type === 'platform') {
    return executePlatformPipeline(input, ctx, requestId);
  }

  return executeTenantPipeline(input, ctx, requestId);
}

// ════════════════════════════════════
// PLATFORM PIPELINE
// ════════════════════════════════════

function executePlatformPipeline(
  input: PipelineInput,
  ctx: SecurityContext,
  requestId: string,
): PipelineResult {
  const { action, resource, skipAudit = false, platformPermission, platformRole } = input;

  // ── Stage 4P: PlatformPermissionGuard ──
  if (platformPermission) {
    const allowed = hasPlatformPermission(platformRole ?? null, platformPermission);
    if (!allowed) {
      const result: PipelineResult = {
        decision: 'deny',
        deniedBy: 'permission',
        deniedAtStage: '4P',
        reason: `Permissão de plataforma negada: ${platformPermission} para role ${platformRole ?? 'unknown'}.`,
        requestId,
        path: 'platform',
      };
      if (!skipAudit) {
        auditSecurity.logAccessDenied({
          resource: `platform:${platformPermission}`,
          reason: result.reason!,
          ctx,
          metadata: { platformRole, stage: '4P' },
        });
      }
      return result;
    }
  }

  // ── Stage 5P: Audit (success) ──
  if (!skipAudit) {
    auditSecurity.logAccessAllowed({
      resource: `platform:${platformPermission ?? `${resource}:${action}`}`,
      action,
      ctx,
      metadata: { platformRole, path: 'platform' },
    });
  }

  return { decision: 'allow', requestId, path: 'platform' };
}

// ════════════════════════════════════
// TENANT PIPELINE
// ════════════════════════════════════

function executeTenantPipeline(
  input: PipelineInput,
  ctx: SecurityContext,
  requestId: string,
): PipelineResult {
  const {
    action, resource, target, guardTarget,
    skipAccessGraph = false, skipPolicy = false, skipAudit = false,
  } = input;

  // ── Stage 4T: IdentitySessionManager — validate IBL session ──
  if (!identityBoundary.isEstablished) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'identity_session',
      deniedAtStage: '4T',
      reason: 'Sessão de identidade não estabelecida no IBL.',
      requestId,
      path: 'tenant',
    }, resource, action, skipAudit, ctx);
  }

  // ── Stage 5T: ContextResolver — validate OperationalContext ──
  const guardResult = contextGuard.validate(
    identityBoundary.identity,
    identityBoundary.operationalContext,
    guardTarget,
  );
  if (!guardResult.passed) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'context',
      deniedAtStage: '5T',
      reason: guardResult.reason,
      requestId,
      path: 'tenant',
    }, resource, action, skipAudit, ctx);
  }

  // ── Stage 6T: AccessGraph — O(1) scope reachability ──
  if (!skipAccessGraph && target) {
    const graph = getAccessGraph();
    if (graph) {
      const scopeReachable = checkAccessGraphReachability(graph, target);
      if (!scopeReachable) {
        return denyAndAudit({
          decision: 'deny',
          deniedBy: 'access_graph',
          deniedAtStage: '6T',
          reason: `Escopo não alcançável no AccessGraph: company=${target.company_id ?? '?'}, group=${target.company_group_id ?? '?'}`,
          requestId,
          path: 'tenant',
        }, resource, action, skipAudit, ctx, { target });
      }
    }
  }

  // ── Stage 7T: PermissionEngine (RBAC + ABAC) ──
  const permResult = checkPermission(action, resource, ctx, target);
  if (permResult.decision === 'deny') {
    const result: PipelineResult = {
      decision: 'deny',
      deniedBy: 'permission',
      deniedAtStage: '7T',
      reason: permResult.reason || `Permissão negada: ${action} em ${resource}.`,
      permissionResult: permResult,
      requestId,
      path: 'tenant',
    };
    if (!skipAudit) {
      auditSecurity.logAccessDenied({
        resource: `${resource}:${action}`,
        reason: result.reason!,
        ctx,
        metadata: { failedCheck: permResult.failedCheck, target, stage: '7T' },
      });
    }
    return result;
  }

  // ── Stage 8T: PolicyEngine (declarative rules) ──
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
        deniedAtStage: '8T',
        reason: policyResult.reason || `Policy negou: ${action} em ${resource}.`,
        policyResult,
        requestId,
        path: 'tenant',
      };
      if (!skipAudit) {
        auditSecurity.logPolicyViolation({
          resource: `${resource}:${action}`,
          reason: result.reason!,
          policyId: policyResult.policyId,
          ctx,
          metadata: { evaluatedRules: policyResult.evaluatedRules, target, stage: '8T' },
        });
      }
      return result;
    }
  }

  // ── Stage 9T: AuditSecurity (success) ──
  if (!skipAudit) {
    auditSecurity.logAccessAllowed({
      resource: `${resource}:${action}`,
      action,
      ctx,
      metadata: { target, path: 'tenant', stagesCleared: '9T' },
    });
  }

  return {
    decision: 'allow',
    requestId,
    permissionResult: permResult,
    path: 'tenant',
  };
}

/**
 * Execute pipeline and throw if denied.
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
  if (!graph) return true;

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
