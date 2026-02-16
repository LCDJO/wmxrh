/**
 * Platform Domain Events
 *
 * Events emitted by platform-level operations.
 * Dual-layer: client-side bus + security_logs persistence.
 *
 * Events:
 *   PlatformUserLoggedIn     — platform admin authenticated
 *   TenantCreated            — new tenant provisioned
 *   TenantSuspended          — tenant suspended/reactivated
 *   PlatformPermissionChanged — platform role or permission modified
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════
// Event Types
// ═══════════════════════════════════

export type PlatformEventType =
  | 'PlatformUserLoggedIn'
  | 'TenantCreated'
  | 'TenantSuspended'
  | 'TenantReactivated'
  | 'PlatformPermissionChanged';

export interface PlatformEventPayload {
  type: PlatformEventType;
  timestamp: string;
  /** Platform user who performed the action */
  actorId: string;
  actorEmail?: string;
  /** Target entity */
  targetType: 'platform_user' | 'tenant' | 'platform_role';
  targetId: string;
  /** Extra context */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════
// Client-Side Event Bus
// ═══════════════════════════════════

type PlatformEventListener = (event: PlatformEventPayload) => void;

const listeners = new Set<PlatformEventListener>();
const eventLog: PlatformEventPayload[] = [];
const MAX_LOG = 200;

export function onPlatformEvent(listener: PlatformEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlatformEventLog(limit = 50): readonly PlatformEventPayload[] {
  return eventLog.slice(-limit);
}

// ═══════════════════════════════════
// Core Emitter
// ═══════════════════════════════════

function emit(event: PlatformEventPayload): void {
  // Log locally
  eventLog.push(event);
  if (eventLog.length > MAX_LOG) eventLog.splice(0, eventLog.length - MAX_LOG);

  console.info(`[PlatformEvent] ${event.type}`, {
    actor: event.actorId,
    target: `${event.targetType}:${event.targetId}`,
    metadata: event.metadata,
  });

  // Persist to security_logs (fire-and-forget)
  supabase.from('security_logs').insert({
    user_id: event.actorId,
    tenant_id: null, // platform events are tenant-agnostic
    action: event.type,
    resource: `${event.targetType}:${event.targetId}`,
    result: 'success',
    ip_address: null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }).then(({ error }) => {
    if (error) console.error('[PlatformEvent] Persist failed:', error.message);
  });

  // Notify listeners
  listeners.forEach(fn => {
    try { fn(event); } catch (err) { console.error('[PlatformEvent] Listener error:', err); }
  });
}

// ═══════════════════════════════════
// Convenience Emitters
// ═══════════════════════════════════

export const platformEvents = {
  userLoggedIn(actorId: string, actorEmail?: string) {
    emit({
      type: 'PlatformUserLoggedIn',
      timestamp: new Date().toISOString(),
      actorId,
      actorEmail,
      targetType: 'platform_user',
      targetId: actorId,
    });
  },

  tenantCreated(actorId: string, tenantId: string, tenantName: string) {
    emit({
      type: 'TenantCreated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { tenantName },
    });
  },

  tenantSuspended(actorId: string, tenantId: string, tenantName: string) {
    emit({
      type: 'TenantSuspended',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { tenantName },
    });
  },

  tenantReactivated(actorId: string, tenantId: string, tenantName: string) {
    emit({
      type: 'TenantReactivated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { tenantName },
    });
  },

  permissionChanged(actorId: string, targetUserId: string, opts: { oldRole?: string; newRole?: string; action: string }) {
    emit({
      type: 'PlatformPermissionChanged',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'platform_role',
      targetId: targetUserId,
      metadata: opts,
    });
  },
};
