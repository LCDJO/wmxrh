/**
 * SecurityKernel — Middleware Pipeline (v4)
 * 
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  UNIFIED REQUEST PIPELINE                                           ║
 * ║                                                                      ║
 * ║  1. RequestId                → generate unique request identifier    ║
 * ║  2. PlatformIdentityResolver → validate auth (SecurityContext)       ║
 * ║  3. UserTypeResolver         → detect platform vs tenant             ║
 * ║  4. ImpersonationResolver    → resolve dual identity, override ctx   ║
 * ║                                                                      ║
 * ║  ┌─ PLATFORM PATH (platform, NOT impersonating) ────────────────┐   ║
 * ║  │  5P. PlatformPermissionGuard → check PlatformPermissionMatrix│   ║
 * ║  │  6P. AuditSecurity           → log result                   │   ║
 * ║  └─────────────────────────────────────────────────────────────┘   ║
 * ║                                                                      ║
 * ║  ┌─ TENANT PATH (tenant OR impersonating) ──────────────────────┐   ║
 * ║  │  5T. IdentitySessionManager  → validate IBL session          │   ║
 * ║  │  6T. ContextResolver         → validate OperationalContext   │   ║
 * ║  │  7T. AccessGraph             → O(1) scope reachability       │   ║
 * ║  │  8T. PermissionEngine        → RBAC + ABAC check             │   ║
 * ║  │  9T. PolicyEngine            → declarative rule evaluation   │   ║
 * ║  │ 10T. AuditSecurity           → log result (+ impersonation)  │   ║
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
import { dualIdentityEngine } from './dual-identity-engine';

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
  /** If this operation was performed under impersonation */
  impersonationMetadata?: Record<string, unknown> | null;
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

  // ── Stage 2: PlatformIdentityResolver — validate auth ──
  if (!ctx) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'auth',
      deniedAtStage: 2,
      reason: 'Usuário não autenticado.',
      requestId,
    }, input.resource, input.action, skipAudit);
  }

  // ── Stage 3: UserTypeResolver — detect platform vs tenant ──
  const rawUserType = ctx.user_type;

  // ── Stage 4: ImpersonationResolver — resolve dual identity ──
  const impersonationMeta = resolveImpersonationContext(ctx, requestId);

  // Route: platform user NOT impersonating → platform path
  if (rawUserType === 'platform' && !dualIdentityEngine.isImpersonating) {
    return executePlatformPipeline(input, ctx, requestId, impersonationMeta);
  }

  // Route: tenant user OR impersonating platform user → tenant path
  return executeTenantPipeline(input, ctx, requestId, impersonationMeta);
}

// ════════════════════════════════════
// STAGE 4: IMPERSONATION RESOLVER MIDDLEWARE
// ════════════════════════════════════

/**
 * ImpersonationResolverMiddleware
 * 
 * Resolves dual identity state and returns audit metadata.
 * When impersonating:
 *   - Records the operation count
 *   - Validates session hasn't expired
 *   - Returns metadata to be injected into all audit entries
 *   - Logs impersonation context for traceability
 */
function resolveImpersonationContext(
  ctx: SecurityContext,
  requestId: string,
): Record<string, unknown> | null {
  // Fast path: no impersonation
  if (!dualIdentityEngine.isImpersonating) {
    return null;
  }

  // Record this operation in the session counter
  dualIdentityEngine.recordOperation();

  // Get audit metadata (real user, session, reason, etc.)
  const meta = dualIdentityEngine.getAuditMetadata();

  // Log trace for every impersonated operation
  if (meta) {
    console.debug(
      `[ImpersonationResolver] requestId=${requestId} ` +
      `realUser=${meta.impersonatedBy} → tenant=${ctx.tenant_id} ` +
      `session=${meta.impersonationSessionId} ` +
      `op#=${dualIdentityEngine.currentSession?.operationCount ?? 0}`
    );
  }

  return meta;
}

// ════════════════════════════════════
// PLATFORM PIPELINE
// ════════════════════════════════════

function executePlatformPipeline(
  input: PipelineInput,
  ctx: SecurityContext,
  requestId: string,
  impersonationMeta?: Record<string, unknown> | null,
): PipelineResult {
  const { action, resource, skipAudit = false, platformPermission, platformRole } = input;

  // ── Stage 5P: PlatformPermissionGuard ──
  if (platformPermission) {
    const allowed = hasPlatformPermission(platformRole ?? null, platformPermission);
    if (!allowed) {
      const result: PipelineResult = {
        decision: 'deny',
        deniedBy: 'permission',
        deniedAtStage: '5P',
        reason: `Permissão de plataforma negada: ${platformPermission} para role ${platformRole ?? 'unknown'}.`,
        requestId,
        path: 'platform',
      };
      if (!skipAudit) {
        auditSecurity.logAccessDenied({
          resource: `platform:${platformPermission}`,
          reason: result.reason!,
          ctx,
          metadata: { platformRole, stage: '5P' },
        });
      }
      return result;
    }
  }

  // ── Stage 6P: Audit (success) ──
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
  impersonationMeta?: Record<string, unknown> | null,
): PipelineResult {
  const {
    action, resource, target, guardTarget,
    skipAccessGraph = false, skipPolicy = false, skipAudit = false,
  } = input;

  // ── Stage 5T: IdentitySessionManager — validate IBL session ──
  if (!identityBoundary.isEstablished) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'identity_session',
      deniedAtStage: '5T',
      reason: 'Sessão de identidade não estabelecida no IBL.',
      requestId,
      path: 'tenant',
    }, resource, action, skipAudit, ctx);
  }

  // ── Stage 6T: ContextResolver — validate OperationalContext ──
  const guardResult = contextGuard.validate(
    identityBoundary.identity,
    identityBoundary.operationalContext,
    guardTarget,
  );
  if (!guardResult.passed) {
    return denyAndAudit({
      decision: 'deny',
      deniedBy: 'context',
      deniedAtStage: '6T',
      reason: guardResult.reason,
      requestId,
      path: 'tenant',
    }, resource, action, skipAudit, ctx);
  }

  // ── Stage 7T: AccessGraph — O(1) scope reachability ──
  if (!skipAccessGraph && target) {
    const graph = getAccessGraph();
    if (graph) {
      const scopeReachable = checkAccessGraphReachability(graph, target);
      if (!scopeReachable) {
        return denyAndAudit({
          decision: 'deny',
          deniedBy: 'access_graph',
          deniedAtStage: '7T',
          reason: `Escopo não alcançável no AccessGraph: company=${target.company_id ?? '?'}, group=${target.company_group_id ?? '?'}`,
          requestId,
          path: 'tenant',
        }, resource, action, skipAudit, ctx, { target });
      }
    }
  }

  // ── Stage 8T: PermissionEngine (RBAC + ABAC) ──
  const permResult = checkPermission(action, resource, ctx, target);
  if (permResult.decision === 'deny') {
    const result: PipelineResult = {
      decision: 'deny',
      deniedBy: 'permission',
      deniedAtStage: '8T',
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
        metadata: { failedCheck: permResult.failedCheck, target, stage: '8T', ...impersonationMeta },
      });
    }
    return result;
  }

  // ── Stage 9T: PolicyEngine (declarative rules) ──
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
        deniedAtStage: '9T',
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
          metadata: { evaluatedRules: policyResult.evaluatedRules, target, stage: '9T', ...impersonationMeta },
        });
      }
      return result;
    }
  }

  // ── Stage 10T: AuditSecurity (success) ──
  if (!skipAudit) {
    auditSecurity.logAccessAllowed({
      resource: `${resource}:${action}`,
      action,
      ctx,
      metadata: { target, path: 'tenant', stagesCleared: '10T', ...impersonationMeta },
    });
  }

  return {
    decision: 'allow',
    requestId,
    permissionResult: permResult,
    path: 'tenant',
    impersonationMetadata: impersonationMeta,
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
