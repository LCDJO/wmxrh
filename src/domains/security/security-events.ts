/**
 * Security Event Emitter
 *
 * Emits structured security events for monitoring and alerting.
 * Events: UnauthorizedAccessAttempt, ScopeViolationDetected, RateLimitTriggered
 *
 * Dual-layer:
 *   - Client-side: emits via listener set for UI reactions (toasts, redirects)
 *   - Backend-side: logged to security_logs table with full metadata
 */

import { supabase } from '@/integrations/supabase/client';

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

/** Emit a security event to all listeners and log to security_logs */
export function emitSecurityEvent(event: SecurityEventPayload): void {
  console.warn(`[SecurityEvent] ${event.type}: ${event.reason}`, {
    resource: event.resource,
    metadata: event.metadata,
  });

  // Persist to security_logs (fire-and-forget)
  supabase.from('security_logs').insert({
    user_id: event.userId || null,
    tenant_id: event.tenantId || null,
    action: event.type,
    resource: event.resource,
    result: 'blocked',
    ip_address: null,
    user_agent: navigator.userAgent || null,
  }).then(({ error }) => {
    if (error) console.error('[SecurityEvent] Failed to persist:', error.message);
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

export const __DOMAIN_CATALOG = {
  domain: 'Security',
  color: 'hsl(0 70% 55%)',
  events: [
    { name: 'UnauthorizedAccessAttempt', description: 'Tentativa de acesso não autorizado' },
    { name: 'ScopeViolationDetected', description: 'Violação de escopo detectada' },
    { name: 'RateLimitTriggered', description: 'Rate limit acionado' },
    { name: 'PermissionDenied', description: 'Permissão negada' },
    { name: 'SuspiciousActivityFlagged', description: 'Atividade suspeita sinalizada' },
  ],
};
