/**
 * Security Event Emitter
 *
 * Emits structured security events for monitoring and alerting.
 * Events: UnauthorizedAccessAttempt, ScopeViolationDetected, RateLimitTriggered
 *
 * Dual-layer:
 *   - Client-side: emits via EventTarget for UI reactions (toasts, redirects)
 *   - Backend-side: logged to audit_logs with security metadata
 */

// ═══════════════════════════════════
// Event Types
// ═══════════════════════════════════

export type SecurityEventType =
  | 'UnauthorizedAccessAttempt'
  | 'ScopeViolationDetected'
  | 'RateLimitTriggered';

export interface SecurityEventPayload {
  type: SecurityEventType;
  timestamp: string;
  userId?: string;
  tenantId?: string;
  /** What resource/action was attempted */
  resource: string;
  /** Why it was blocked */
  reason: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════
// Client-Side Event Bus
// ═══════════════════════════════════

type SecurityEventListener = (event: SecurityEventPayload) => void;

const listeners = new Set<SecurityEventListener>();

/** Subscribe to all security events */
export function onSecurityEvent(listener: SecurityEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Emit a security event to all listeners */
export function emitSecurityEvent(event: SecurityEventPayload): void {
  console.warn(`[SecurityEvent] ${event.type}: ${event.reason}`, {
    resource: event.resource,
    metadata: event.metadata,
  });
  listeners.forEach(fn => {
    try { fn(event); } catch (err) { console.error('[SecurityEvent] Listener error:', err); }
  });
}

// ═══════════════════════════════════
// Convenience Emitters
// ═══════════════════════════════════

export function emitUnauthorizedAccess(opts: {
  resource: string;
  reason: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}): void {
  emitSecurityEvent({
    type: 'UnauthorizedAccessAttempt',
    timestamp: new Date().toISOString(),
    ...opts,
  });
}

export function emitScopeViolation(opts: {
  resource: string;
  reason: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}): void {
  emitSecurityEvent({
    type: 'ScopeViolationDetected',
    timestamp: new Date().toISOString(),
    ...opts,
  });
}

export function emitRateLimitTriggered(opts: {
  resource: string;
  reason: string;
  userId?: string;
  tenantId?: string;
  retryAfterMs?: number;
  metadata?: Record<string, unknown>;
}): void {
  emitSecurityEvent({
    type: 'RateLimitTriggered',
    timestamp: new Date().toISOString(),
    resource: opts.resource,
    reason: opts.reason,
    userId: opts.userId,
    tenantId: opts.tenantId,
    metadata: { ...opts.metadata, retryAfterMs: opts.retryAfterMs },
  });
}
