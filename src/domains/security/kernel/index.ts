/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   SECURITY KERNEL                       ║
 * ║                                                         ║
 * ║  Camada central de segurança enterprise desacoplada.     ║
 * ║  Nenhum Bounded Context implementa regras de acesso     ║
 * ║  próprias — tudo passa pelo Kernel.                     ║
 * ║                                                         ║
 * ║  SecurityKernel                                         ║
 * ║   ├── IdentityService     (quem é o usuário)            ║
 * ║   ├── PermissionEngine    (o que pode fazer)            ║
 * ║   ├── PolicyEngine        (regras dinâmicas)            ║
 * ║   ├── ScopeResolver       (onde pode acessar)           ║
 * ║   ├── FeatureFlagEngine   (o que está habilitado)       ║
 * ║   └── AuditSecurityService(registrar tudo)              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Identity ───────────────────────────────────────────────
export { resolveIdentity } from './identity.service';
export type { Identity } from './identity.service';

// ── Permission Engine ──────────────────────────────────────
export { permissionEngine } from './permission-engine';
export type { PermissionEngineAPI, PermissionCheck } from './permission-engine';

// ── Policy Engine ──────────────────────────────────────────
export { policyEngine, requireAtLeastOneRole, requireValidScope, preventCrossTenantAccess } from './policy-engine';
export type { PolicyEngineAPI, PolicyFn, PolicyContext, PolicyResult, PolicyDecision } from './policy-engine';

// ── Scope Resolver ─────────────────────────────────────────
export { resolveScope } from './scope-resolver';
export type { ScopeResolution, ScopeResolverInput } from './scope-resolver';

// ── Feature Flag Engine ────────────────────────────────────
export { featureFlagEngine } from './feature-flag-engine';
export type { FeatureFlagEngineAPI, FeatureFlagContext } from './feature-flag-engine';

// ── Audit Security ─────────────────────────────────────────
export { auditSecurity } from './audit-security.service';
export type { AuditSecurityAPI, AuditEntry, AuditAction } from './audit-security.service';
