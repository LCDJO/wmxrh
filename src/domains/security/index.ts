/**
 * Security Middleware - Public API
 * 
 * Single import point for all security concerns.
 */

// ══════════════════════════════════════
// SECURITY KERNEL (primary API)
// ══════════════════════════════════════
export {
  resolveIdentity,
  buildSecurityContext,
  permissionEngine,
  checkPermission,
  policyEngine,
  BUILTIN_RULES,
  resolveScope,
  resolveScopeFromContext,
  buildQueryScope,
  scopedInsertFromContext,
  featureFlagEngine,
  auditSecurity,
  onSecurityEvent,
  requireAtLeastOneRole,
  requireValidScope,
  preventCrossTenantAccess,
} from './kernel';
export type {
  Identity,
  SecurityContext,
  SecurityScope,
  BuildSecurityContextInput,
  PermissionEngineAPI,
  PermissionCheck,
  PermissionResult,
  PermissionDecision,
  ResourceTarget,
  PolicyEngineAPI,
  PolicyFn,
  PolicyContext,
  PolicyResult,
  PolicyDecision,
  PolicyRule,
  PolicyEffect,
  PolicyCondition,
  PolicyEvalContext,
  ScopeResolution,
  ScopeResolverInput,
  ResolvedQueryScope,
  FeatureFlagEngineAPI,
  FeatureFlagContext,
  FeatureFlagRecord,
  AuditSecurityAPI,
  AuditEntry,
  AuditAction,
  AuditResult,
  SecurityEventType,
  SecurityEventPayload,
} from './kernel';

// ── Feature Flags Hook ──
export { useFeatureFlags } from './use-feature-flags';
export type { UseFeatureFlagsReturn } from './use-feature-flags';

// ── Kernel Hook ──
export { useSecurityKernel } from './use-security-kernel';
export type { UseSecurityKernelReturn } from './use-security-kernel';

// ══════════════════════════════════════
// LEGACY / COMPAT (delegates to kernel)
// ══════════════════════════════════════

// Permissions (raw matrix)
export { PERMISSION_MATRIX, hasPermission, canAccessNavItem } from './permissions';
export type { PermissionAction, PermissionEntity, NavKey } from './permissions';

// Hooks
export { usePermissions } from './use-permissions';
export type { UsePermissionsReturn } from './use-permissions';
export { useDataMasking } from './use-data-masking';
export type { UseDataMaskingReturn } from './use-data-masking';

// Route Guard
export { ProtectedRoute } from './ProtectedRoute';

// Mutation Security
export { validateMutation, secureMutation, SecurityError } from './secure-mutation';

// Rate Limiter
export { checkRateLimit, resetRateLimit, RATE_LIMITS } from './rate-limiter';

// Security Events (legacy emitters — re-exported for backward compat)
export {
  emitSecurityEvent,
  emitUnauthorizedAccess,
  emitScopeViolation,
  emitRateLimitTriggered,
} from './security-events';

// Security Monitor
export { useSecurityMonitor } from './useSecurityMonitor';

// Security Logs
export { securityLogService } from './security-log.service';
export type { SecurityLog } from './security-log.service';

// Feature Flags
export { SECURITY_FEATURES, BUSINESS_FEATURES } from './feature-flags';
export type { SecurityFeatureKey, BusinessFeatureKey, FeatureKey } from './feature-flags';

// Data Masking
export { maskSalary, maskCPF, maskBankAccount, formatSalary, formatCPF, getMaskingPolicy, displaySalary, displayCPF, displayBankAccount } from './data-masking';
export type { MaskingPolicy } from './data-masking';

// MFA Ready
export { mfaService } from './mfa-ready';
export type { MFAStatus } from './mfa-ready';

// SSO Ready
export { ssoService } from './sso-ready';
export type { SSOProvider, SSOConfig } from './sso-ready';

// LGPD Ready
export { lgpdService, anonymizeName, anonymizeEmail, anonymizePhone } from './lgpd-ready';
export type { ConsentPurpose, ConsentRecord, DataExportRequest, AnonymizationRequest } from './lgpd-ready';
