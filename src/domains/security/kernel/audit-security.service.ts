/**
 * SecurityKernel — AuditSecurityService
 * 
 * Unified audit interface for ALL security events.
 * 
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ALL security actions go through this service.           ║
 * ║  Dual-layer: DB persistence + client-side event bus.     ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * Events:
 *   - UnauthorizedAccessAttempt
 *   - PolicyViolationDetected
 *   - ScopeMismatchDetected
 *   - RateLimitTriggered
 *   - FeatureBlocked
 *   - MutationBlocked
 * 
 * Every log entry captures: request_id, user_id, tenant_id,
 * resource, action, result, ip_address, timestamp.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SecurityContext } from './identity.service';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export type AuditAction =
  | 'access_denied'
  | 'scope_violation'
  | 'scope_mismatch'
  | 'rate_limited'
  | 'policy_denied'
  | 'policy_violation'
  | 'feature_blocked'
  | 'login_attempt'
  | 'mutation_blocked'
  | 'unauthorized_access'
  | 'identity_cleared'
  | 'identity_established'
  | 'tenant_switched'
  | 'scope_switched'
  | 'impersonation_started'
  | 'impersonation_ended'
  | 'impersonated_action'
  | 'workspace_switched';

export type AuditResult = 'allowed' | 'blocked' | 'success';

export type SecurityEventType =
  | 'UnauthorizedAccessAttempt'
  | 'PolicyViolationDetected'
  | 'ScopeMismatchDetected'
  | 'RateLimitTriggered'
  | 'FeatureBlocked'
  | 'MutationBlocked'
  | 'ImpersonationStarted'
  | 'ImpersonationEnded'
  | 'ImpersonatedActionExecuted';

export interface AuditEntry {
  /** Auto-mapped from SecurityContext if provided */
  request_id?: string;
  user_id?: string;
  tenant_id?: string;
  /** The real user behind the action (for impersonation) */
  real_user_id?: string;
  /** The active/effective user performing the action */
  active_user_id?: string;
  /** Impersonation session reference */
  impersonation_session_id?: string;
  action: AuditAction;
  resource: string;
  result: AuditResult;
  reason: string;
  ip_address?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SecurityEventPayload {
  type: SecurityEventType;
  timestamp: string;
  request_id?: string;
  user_id?: string;
  tenant_id?: string;
  resource: string;
  reason: string;
  result: AuditResult;
  metadata?: Record<string, unknown>;
}

// ════════════════════════════════════
// CLIENT-SIDE EVENT BUS
// ════════════════════════════════════

type SecurityEventListener = (event: SecurityEventPayload) => void;
const listeners = new Set<SecurityEventListener>();

/** Subscribe to security events */
export function onSecurityEvent(listener: SecurityEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(event: SecurityEventPayload): void {
  listeners.forEach(fn => {
    try { fn(event); } catch (err) { console.error('[AuditSecurity] Listener error:', err); }
  });
}

// ════════════════════════════════════
// PERSISTENCE (fire-and-forget)
// ════════════════════════════════════

function persistToDb(entry: AuditEntry): void {
  supabase.from('security_logs').insert({
    request_id: entry.request_id || null,
    user_id: entry.user_id || null,
    tenant_id: entry.tenant_id || null,
    real_user_id: entry.real_user_id || null,
    active_user_id: entry.active_user_id || null,
    impersonation_session_id: entry.impersonation_session_id || null,
    action: entry.action,
    resource: entry.resource,
    result: entry.result,
    ip_address: entry.ip_address || null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }).then(({ error }) => {
    if (error) console.error('[AuditSecurity] Failed to persist:', error.message);
  });
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

const ACTION_TO_EVENT: Record<AuditAction, SecurityEventType> = {
  access_denied: 'UnauthorizedAccessAttempt',
  unauthorized_access: 'UnauthorizedAccessAttempt',
  scope_violation: 'ScopeMismatchDetected',
  scope_mismatch: 'ScopeMismatchDetected',
  rate_limited: 'RateLimitTriggered',
  policy_denied: 'PolicyViolationDetected',
  policy_violation: 'PolicyViolationDetected',
  feature_blocked: 'FeatureBlocked',
  login_attempt: 'UnauthorizedAccessAttempt',
  mutation_blocked: 'MutationBlocked',
  identity_cleared: 'UnauthorizedAccessAttempt',
  identity_established: 'UnauthorizedAccessAttempt',
  tenant_switched: 'ScopeMismatchDetected',
  scope_switched: 'ScopeMismatchDetected',
  impersonation_started: 'ImpersonationStarted',
  impersonation_ended: 'ImpersonationEnded',
  impersonated_action: 'ImpersonatedActionExecuted',
  workspace_switched: 'ScopeMismatchDetected',
};

function buildEntry(
  action: AuditAction,
  result: AuditResult,
  opts: {
    resource: string;
    reason: string;
    ctx?: SecurityContext | null;
    metadata?: Record<string, unknown>;
  },
): AuditEntry {
  // Auto-enrich with impersonation fields from SecurityContext
  const isImpersonating = opts.ctx?.is_impersonating;
  return {
    request_id: opts.ctx?.request_id,
    user_id: opts.ctx?.user_id,
    tenant_id: opts.ctx?.tenant_id,
    real_user_id: isImpersonating ? opts.ctx?.real_identity?.userId : undefined,
    active_user_id: isImpersonating ? opts.ctx?.active_identity?.userId : undefined,
    impersonation_session_id: isImpersonating ? (opts.metadata?.impersonationSessionId as string) : undefined,
    action,
    resource: opts.resource,
    result,
    reason: opts.reason,
    metadata: opts.metadata,
  };
}

function emitAndPersist(entry: AuditEntry): void {
  const eventType = ACTION_TO_EVENT[entry.action];
  const timestamp = new Date().toISOString();

  console.warn(`[AuditSecurity] ${eventType}: ${entry.reason}`, {
    request_id: entry.request_id,
    resource: entry.resource,
    result: entry.result,
  });

  // Persist to DB
  persistToDb(entry);

  // Notify listeners
  notifyListeners({
    type: eventType,
    timestamp,
    request_id: entry.request_id,
    user_id: entry.user_id,
    tenant_id: entry.tenant_id,
    resource: entry.resource,
    reason: entry.reason,
    result: entry.result,
    metadata: entry.metadata,
  });
}

// ════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════

export interface AuditSecurityAPI {
  // ── Context-aware logging (preferred) ──

  /** Log unauthorized access attempt */
  logAccessDenied: (opts: { resource: string; reason: string; ctx?: SecurityContext | null; metadata?: Record<string, unknown> }) => void;

  /** Log policy violation (declarative rules) */
  logPolicyViolation: (opts: { resource: string; reason: string; policyId: string; ctx?: SecurityContext | null; metadata?: Record<string, unknown> }) => void;

  /** Log scope mismatch (user tried to access out-of-scope data) */
  logScopeMismatch: (opts: { resource: string; reason: string; ctx?: SecurityContext | null; expectedScope?: string; actualScope?: string; metadata?: Record<string, unknown> }) => void;

  /** Log rate limit hit */
  logRateLimited: (opts: { resource: string; reason: string; ctx?: SecurityContext | null; retryAfterMs?: number; metadata?: Record<string, unknown> }) => void;

  /** Log feature flag block */
  logFeatureBlocked: (opts: { resource: string; reason: string; feature: string; ctx?: SecurityContext | null; metadata?: Record<string, unknown> }) => void;

  /** Log mutation blocked by security check */
  logMutationBlocked: (opts: { resource: string; reason: string; ctx?: SecurityContext | null; metadata?: Record<string, unknown> }) => void;

  /** Log allowed access (for audit trail of sensitive operations) */
  logAccessAllowed: (opts: { resource: string; action: string; ctx?: SecurityContext | null; metadata?: Record<string, unknown> }) => void;

  // ── Impersonation-specific audit (OBRIGATÓRIO) ──

  /** Log ImpersonationStarted with real_user_id, active_user_id, tenant_id */
  logImpersonationStarted: (opts: {
    realUserId: string;
    activeUserId: string;
    tenantId: string;
    sessionId: string;
    reason: string;
    simulatedRole: string;
    platformRole: string;
    metadata?: Record<string, unknown>;
  }) => void;

  /** Log ImpersonationEnded */
  logImpersonationEnded: (opts: {
    realUserId: string;
    activeUserId: string;
    tenantId: string;
    sessionId: string;
    endReason: string;
    durationMs: number;
    operationCount: number;
    metadata?: Record<string, unknown>;
  }) => void;

  /** Log ImpersonatedActionExecuted — every mutation during impersonation */
  logImpersonatedAction: (opts: {
    realUserId: string;
    activeUserId: string;
    tenantId: string;
    sessionId: string;
    resource: string;
    actionDescription: string;
    metadata?: Record<string, unknown>;
  }) => void;

  /** Generic log entry */
  log: (entry: AuditEntry) => void;

  // ── Event subscription ──
  onEvent: typeof onSecurityEvent;
}

export const auditSecurity: AuditSecurityAPI = {
  logAccessDenied: (opts) => {
    emitAndPersist(buildEntry('access_denied', 'blocked', opts));
  },

  logPolicyViolation: (opts) => {
    emitAndPersist(buildEntry('policy_violation', 'blocked', {
      ...opts,
      reason: `[Policy: ${opts.policyId}] ${opts.reason}`,
      metadata: { ...opts.metadata, policyId: opts.policyId },
    }));
  },

  logScopeMismatch: (opts) => {
    emitAndPersist(buildEntry('scope_mismatch', 'blocked', {
      ...opts,
      metadata: {
        ...opts.metadata,
        expectedScope: opts.expectedScope,
        actualScope: opts.actualScope,
      },
    }));
  },

  logRateLimited: (opts) => {
    emitAndPersist(buildEntry('rate_limited', 'blocked', {
      ...opts,
      metadata: { ...opts.metadata, retryAfterMs: opts.retryAfterMs },
    }));
  },

  logFeatureBlocked: (opts) => {
    emitAndPersist(buildEntry('feature_blocked', 'blocked', {
      ...opts,
      reason: `[Feature: ${opts.feature}] ${opts.reason}`,
      metadata: { ...opts.metadata, feature: opts.feature },
    }));
  },

  logMutationBlocked: (opts) => {
    emitAndPersist(buildEntry('mutation_blocked', 'blocked', opts));
  },

  logAccessAllowed: (opts) => {
    const entry: AuditEntry = {
      request_id: opts.ctx?.request_id,
      user_id: opts.ctx?.user_id,
      tenant_id: opts.ctx?.tenant_id,
      action: opts.action as AuditAction,
      resource: opts.resource,
      result: 'allowed',
      reason: 'Access granted',
      metadata: opts.metadata,
    };
    persistToDb(entry);
  },

  log: (entry) => {
    emitAndPersist(entry);
  },

  // ── Impersonation audit methods ──

  logImpersonationStarted: (opts) => {
    const entry: AuditEntry = {
      user_id: opts.realUserId,
      real_user_id: opts.realUserId,
      active_user_id: opts.activeUserId,
      tenant_id: opts.tenantId,
      impersonation_session_id: opts.sessionId,
      action: 'impersonation_started',
      resource: 'dual_identity_engine',
      result: 'success',
      reason: `Impersonation started: ${opts.platformRole} → tenant ${opts.tenantId} as ${opts.simulatedRole}`,
      metadata: {
        ...opts.metadata,
        sessionId: opts.sessionId,
        simulatedRole: opts.simulatedRole,
        platformRole: opts.platformRole,
        reason: opts.reason,
      },
    };
    emitAndPersist(entry);
  },

  logImpersonationEnded: (opts) => {
    const entry: AuditEntry = {
      user_id: opts.realUserId,
      real_user_id: opts.realUserId,
      active_user_id: opts.activeUserId,
      tenant_id: opts.tenantId,
      impersonation_session_id: opts.sessionId,
      action: 'impersonation_ended',
      resource: 'dual_identity_engine',
      result: 'success',
      reason: `Impersonation ended (${opts.endReason}): ${opts.operationCount} ops in ${Math.round(opts.durationMs / 1000)}s`,
      metadata: {
        ...opts.metadata,
        sessionId: opts.sessionId,
        endReason: opts.endReason,
        durationMs: opts.durationMs,
        operationCount: opts.operationCount,
      },
    };
    emitAndPersist(entry);
  },

  logImpersonatedAction: (opts) => {
    const entry: AuditEntry = {
      user_id: opts.realUserId,
      real_user_id: opts.realUserId,
      active_user_id: opts.activeUserId,
      tenant_id: opts.tenantId,
      impersonation_session_id: opts.sessionId,
      action: 'impersonated_action',
      resource: opts.resource,
      result: 'allowed',
      reason: `[Impersonated] ${opts.actionDescription}`,
      metadata: {
        ...opts.metadata,
        sessionId: opts.sessionId,
        impersonated: true,
      },
    };
    emitAndPersist(entry);
  },

  onEvent: onSecurityEvent,
};
