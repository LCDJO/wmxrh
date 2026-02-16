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
  | 'unauthorized_access';

export type AuditResult = 'allowed' | 'blocked';

export type SecurityEventType =
  | 'UnauthorizedAccessAttempt'
  | 'PolicyViolationDetected'
  | 'ScopeMismatchDetected'
  | 'RateLimitTriggered'
  | 'FeatureBlocked'
  | 'MutationBlocked';

export interface AuditEntry {
  /** Auto-mapped from SecurityContext if provided */
  request_id?: string;
  user_id?: string;
  tenant_id?: string;
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
  return {
    request_id: opts.ctx?.request_id,
    user_id: opts.ctx?.user_id,
    tenant_id: opts.ctx?.tenant_id,
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

  onEvent: onSecurityEvent,
};
