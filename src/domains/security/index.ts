/**
 * Security Middleware - Public API
 * 
 * Single import point for all security concerns.
 */

export { PERMISSION_MATRIX, hasPermission, canAccessNavItem } from './permissions';
export type { PermissionAction, PermissionEntity, NavKey } from './permissions';

export { usePermissions } from './use-permissions';
export type { UsePermissionsReturn } from './use-permissions';

export { ProtectedRoute } from './ProtectedRoute';

export { validateMutation, secureMutation, SecurityError } from './secure-mutation';

export { checkRateLimit, resetRateLimit, RATE_LIMITS } from './rate-limiter';

export {
  emitSecurityEvent,
  emitUnauthorizedAccess,
  emitScopeViolation,
  emitRateLimitTriggered,
  onSecurityEvent,
} from './security-events';
export type { SecurityEventType, SecurityEventPayload } from './security-events';

export { useSecurityMonitor } from './useSecurityMonitor';
