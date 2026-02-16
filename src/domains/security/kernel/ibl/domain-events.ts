/**
 * IBL Domain Events
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Typed domain events emitted by IBL components:              ║
 * ║                                                              ║
 * ║  1. ContextSwitched            → successful scope change     ║
 * ║  2. IdentitySessionStarted    → session established          ║
 * ║  3. IdentitySessionRefreshed  → scopes/roles updated         ║
 * ║  4. UnauthorizedContextSwitch → switch attempt denied         ║
 * ║                                                              ║
 * ║  All events are emitted synchronously to local listeners     ║
 * ║  and persisted to audit log asynchronously.                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { ScopeType, TenantRole } from '@/domains/shared/types';
import type { IdentityProvider, AllowedScopes } from '../identity-boundary.types';

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type IBLDomainEventType =
  | 'ContextSwitched'
  | 'IdentitySessionStarted'
  | 'IdentitySessionRefreshed'
  | 'UnauthorizedContextSwitch';

// ── ContextSwitched ──

export interface ContextSwitchedPayload {
  type: 'ContextSwitched';
  timestamp: number;
  userId: string;
  switchType: 'tenant' | 'group' | 'company' | 'scope';
  switchCount: number;
  previous: ContextSnapshotPayload | null;
  current: ContextSnapshotPayload;
}

export interface ContextSnapshotPayload {
  tenantId: string;
  tenantName: string;
  scopeLevel: ScopeType;
  groupId: string | null;
  companyId: string | null;
}

// ── IdentitySessionStarted ──

export interface IdentitySessionStartedPayload {
  type: 'IdentitySessionStarted';
  timestamp: number;
  userId: string;
  email: string | null;
  provider: IdentityProvider;
  tenantCount: number;
  tenantIds: string[];
  roles: TenantRole[];
  allowedScopes: AllowedScopes;
  hasAccessGraph: boolean;
}

// ── IdentitySessionRefreshed ──

export interface IdentitySessionRefreshedPayload {
  type: 'IdentitySessionRefreshed';
  timestamp: number;
  userId: string;
  tenantCount: number;
  roleCount: number;
  addedRoles: TenantRole[];
  removedRoles: TenantRole[];
}

// ── UnauthorizedContextSwitch ──

export interface UnauthorizedContextSwitchPayload {
  type: 'UnauthorizedContextSwitch';
  timestamp: number;
  userId: string | null;
  targetTenantId: string | null;
  targetGroupId: string | null;
  targetCompanyId: string | null;
  failedValidation: string;
  reason: string;
}

// ── Union ──

export type IBLDomainEvent =
  | ContextSwitchedPayload
  | IdentitySessionStartedPayload
  | IdentitySessionRefreshedPayload
  | UnauthorizedContextSwitchPayload;

// ════════════════════════════════════
// EVENT BUS (synchronous, in-memory)
// ════════════════════════════════════

type IBLEventListener<T extends IBLDomainEvent = IBLDomainEvent> = (event: T) => void;

/** All-events listeners */
const globalListeners = new Set<IBLEventListener>();

/** Per-type listeners */
const typedListeners = new Map<IBLDomainEventType, Set<IBLEventListener<any>>>();

/**
 * Subscribe to ALL IBL domain events.
 */
export function onIBLEvent(listener: IBLEventListener): () => void {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}

/**
 * Subscribe to a specific IBL domain event type.
 */
export function onIBLEventType<T extends IBLDomainEvent>(
  type: T['type'],
  listener: IBLEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) {
    typedListeners.set(type, new Set());
  }
  typedListeners.get(type)!.add(listener);
  return () => typedListeners.get(type)?.delete(listener);
}

/**
 * Emit an IBL domain event to all matching listeners.
 */
export function emitIBLEvent(event: IBLDomainEvent): void {
  // Global listeners
  for (const listener of globalListeners) {
    try { listener(event); } catch { /* swallow */ }
  }

  // Typed listeners
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const listener of typed) {
      try { listener(event); } catch { /* swallow */ }
    }
  }
}

// ════════════════════════════════════
// EVENT LOG (last N events for debugging)
// ════════════════════════════════════

const MAX_EVENT_LOG = 50;
const eventLog: IBLDomainEvent[] = [];

/** Get recent IBL events (newest first) */
export function getIBLEventLog(): ReadonlyArray<IBLDomainEvent> {
  return eventLog;
}

/** Clear event log */
export function clearIBLEventLog(): void {
  eventLog.length = 0;
}

// Auto-log all events
onIBLEvent((event) => {
  eventLog.unshift(event);
  if (eventLog.length > MAX_EVENT_LOG) eventLog.pop();
});
