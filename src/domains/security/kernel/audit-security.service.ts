/**
 * SecurityKernel — AuditSecurityService
 * 
 * Unified audit interface for security events.
 * Combines security_logs persistence with client-side event emission.
 * 
 * All security-relevant actions should go through this service,
 * NOT directly to security-events.ts or security-log.service.ts.
 */

import {
  emitSecurityEvent,
  emitUnauthorizedAccess,
  emitScopeViolation,
  emitRateLimitTriggered,
  type SecurityEventPayload,
} from '../security-events';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export type AuditAction =
  | 'access_denied'
  | 'scope_violation'
  | 'rate_limited'
  | 'policy_denied'
  | 'feature_blocked'
  | 'login_attempt'
  | 'mutation_blocked';

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  reason: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

// ════════════════════════════════════
// SERVICE
// ════════════════════════════════════

export interface AuditSecurityAPI {
  /** Log an access denied event */
  logAccessDenied: (entry: Omit<AuditEntry, 'action'>) => void;
  /** Log a scope violation */
  logScopeViolation: (entry: Omit<AuditEntry, 'action'>) => void;
  /** Log a rate limit hit */
  logRateLimited: (entry: Omit<AuditEntry, 'action'> & { retryAfterMs?: number }) => void;
  /** Log a policy denial */
  logPolicyDenied: (entry: Omit<AuditEntry, 'action'> & { policyId: string }) => void;
  /** Log a feature flag block */
  logFeatureBlocked: (entry: Omit<AuditEntry, 'action'> & { feature: string }) => void;
  /** Generic audit log */
  log: (entry: AuditEntry) => void;
}

export const auditSecurity: AuditSecurityAPI = {
  logAccessDenied: (entry) => {
    emitUnauthorizedAccess({
      resource: entry.resource,
      reason: entry.reason,
      userId: entry.userId,
      tenantId: entry.tenantId,
      metadata: entry.metadata,
    });
  },

  logScopeViolation: (entry) => {
    emitScopeViolation({
      resource: entry.resource,
      reason: entry.reason,
      userId: entry.userId,
      tenantId: entry.tenantId,
      metadata: entry.metadata,
    });
  },

  logRateLimited: (entry) => {
    emitRateLimitTriggered({
      resource: entry.resource,
      reason: entry.reason,
      userId: entry.userId,
      tenantId: entry.tenantId,
      retryAfterMs: entry.retryAfterMs,
      metadata: entry.metadata,
    });
  },

  logPolicyDenied: (entry) => {
    emitSecurityEvent({
      type: 'UnauthorizedAccessAttempt',
      timestamp: new Date().toISOString(),
      resource: entry.resource,
      reason: `[Policy: ${entry.policyId}] ${entry.reason}`,
      userId: entry.userId,
      tenantId: entry.tenantId,
      metadata: { ...entry.metadata, policyId: entry.policyId },
    });
  },

  logFeatureBlocked: (entry) => {
    emitSecurityEvent({
      type: 'UnauthorizedAccessAttempt',
      timestamp: new Date().toISOString(),
      resource: entry.resource,
      reason: `[Feature: ${entry.feature}] ${entry.reason}`,
      userId: entry.userId,
      tenantId: entry.tenantId,
      metadata: { ...entry.metadata, feature: entry.feature },
    });
  },

  log: (entry) => {
    const typeMap: Record<AuditAction, SecurityEventPayload['type']> = {
      access_denied: 'UnauthorizedAccessAttempt',
      scope_violation: 'ScopeViolationDetected',
      rate_limited: 'RateLimitTriggered',
      policy_denied: 'UnauthorizedAccessAttempt',
      feature_blocked: 'UnauthorizedAccessAttempt',
      login_attempt: 'UnauthorizedAccessAttempt',
      mutation_blocked: 'UnauthorizedAccessAttempt',
    };

    emitSecurityEvent({
      type: typeMap[entry.action],
      timestamp: new Date().toISOString(),
      resource: entry.resource,
      reason: entry.reason,
      userId: entry.userId,
      tenantId: entry.tenantId,
      metadata: entry.metadata,
    });
  },
};
