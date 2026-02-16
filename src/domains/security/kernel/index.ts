/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   SECURITY KERNEL                       ║
 * ║                                                         ║
 * ║  Camada central de segurança enterprise desacoplada.     ║
 * ║  Nenhum Bounded Context implementa regras de acesso     ║
 * ║  próprias — tudo passa pelo Kernel.                     ║
 * ║                                                         ║
 * ║  SecurityKernel                                         ║
 * ║   ├── IdentityService     (quem é + SecurityContext)    ║
 * ║   ├── PermissionEngine    (o que pode fazer)            ║
 * ║   ├── PolicyEngine        (regras dinâmicas)            ║
 * ║   ├── ScopeResolver       (onde pode acessar)           ║
 * ║   ├── FeatureFlagEngine   (o que está habilitado)       ║
 * ║   ├── AuditSecurityService(registrar tudo)              ║
 * ║   └── SecurityPipeline    (orquestra tudo)              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Identity + SecurityContext ─────────────────────────────
export { resolveIdentity, buildSecurityContext } from './identity.service';
export type { Identity, SecurityContext, SecurityScope, BuildSecurityContextInput } from './identity.service';

// ── Permission Engine ──────────────────────────────────────
export { permissionEngine, checkPermission } from './permission-engine';
export type { PermissionEngineAPI, PermissionCheck, PermissionResult, PermissionDecision, ResourceTarget } from './permission-engine';

// ── Policy Engine ──────────────────────────────────────────
export { policyEngine, requireAtLeastOneRole, requireValidScope, preventCrossTenantAccess, BUILTIN_RULES } from './policy-engine';
export type {
  PolicyEngineAPI, PolicyFn, PolicyContext, PolicyResult, PolicyDecision,
  PolicyRule, PolicyEffect, PolicyCondition, PolicyEvalContext,
} from './policy-engine';

// ── Scope Resolver ─────────────────────────────────────────
export { resolveScope, resolveScopeFromContext, buildQueryScope, scopedInsertFromContext } from './scope-resolver';
export type { ScopeResolution, ScopeResolverInput, ResolvedQueryScope } from './scope-resolver';

// ── Feature Flag Engine ────────────────────────────────────
export { featureFlagEngine } from './feature-flag-engine';
export type { FeatureFlagEngineAPI, FeatureFlagContext, FeatureFlagRecord } from './feature-flag-engine';

// ── Audit Security ─────────────────────────────────────────
export { auditSecurity, onSecurityEvent } from './audit-security.service';
export type { AuditSecurityAPI, AuditEntry, AuditAction, AuditResult, SecurityEventType, SecurityEventPayload } from './audit-security.service';

// ── Security Pipeline ──────────────────────────────────────
export { executeSecurityPipeline, requirePermission, SecurityPipelineError } from './security-pipeline';
export type { PipelineResult, PipelineInput, PipelineDecision } from './security-pipeline';

// ── Access Graph ───────────────────────────────────────────
export { AccessGraph, buildAccessGraph, getAccessGraph, setAccessGraph, clearAccessGraph } from './access-graph';
export type { AccessGraphInput, GraphNode, GraphEdge, NodeType, EdgeRelation } from './access-graph';

// ── Access Graph Service ───────────────────────────────────
export { accessGraphService } from './access-graph.service';
export type { InheritedScopes, InheritanceEntry, AccessCheckResult } from './access-graph.service';

// ── Access Graph Cache ─────────────────────────────────────
export { accessGraphCache } from './access-graph.cache';
export type { AccessGraphCacheEntry, CacheInvalidationReason, CacheInvalidationEvent } from './access-graph.cache';

// ── Access Graph Events ────────────────────────────────────
export { emitGraphEvent, onGraphEvent, getGraphEventLog, clearGraphEventLog, graphEvents } from './access-graph.events';
export type { GraphEventType, GraphEvent } from './access-graph.events';
