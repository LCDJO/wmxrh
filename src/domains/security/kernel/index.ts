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
 * ║   └── AuditSecurityService(registrar tudo)              ║
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
export { auditSecurity } from './audit-security.service';
export type { AuditSecurityAPI, AuditEntry, AuditAction } from './audit-security.service';
