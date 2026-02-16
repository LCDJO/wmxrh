/**
 * IAM Domain Events
 *
 * ╔════════════════════════════════════════════════════════════╗
 * ║  Typed domain events emitted by the IdentityGateway:       ║
 * ║                                                            ║
 * ║  1. UserInvited             → new tenant member created    ║
 * ║  2. UserRoleAssigned        → role bound to user + scope   ║
 * ║  3. UserRoleRemoved         → role unbound from user       ║
 * ║  4. RolePermissionsUpdated  → permission set changed       ║
 * ║  5. AccessGraphRebuilt      → graph cache invalidated      ║
 * ║                                                            ║
 * ║  Pure data — NO UI, NO side-effects inside this file.      ║
 * ╚════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type IAMEventType =
  | 'UserInvited'
  | 'UserRoleAssigned'
  | 'UserRoleRemoved'
  | 'RolePermissionsUpdated'
  | 'AccessGraphRebuilt';

// ── Payloads ──

export interface UserInvitedPayload {
  type: 'UserInvited';
  timestamp: number;
  tenant_id: string;
  email: string;
  user_id: string;
  invited_by?: string;
}

export interface UserRoleAssignedPayload {
  type: 'UserRoleAssigned';
  timestamp: number;
  tenant_id: string;
  user_id: string;
  role_id: string;
  scope_type?: string;
  scope_id?: string | null;
  assigned_by?: string;
}

export interface UserRoleRemovedPayload {
  type: 'UserRoleRemoved';
  timestamp: number;
  tenant_id: string;
  user_id: string;
  assignment_id: string;
}

export interface RolePermissionsUpdatedPayload {
  type: 'RolePermissionsUpdated';
  timestamp: number;
  tenant_id: string;
  role_id: string;
  permission_count: number;
  granted_by?: string;
}

export interface AccessGraphRebuiltPayload {
  type: 'AccessGraphRebuilt';
  timestamp: number;
  tenant_id: string;
  user_id: string | null;
  reason: IAMEventType;
}

// ── Union ──

export type IAMDomainEvent =
  | UserInvitedPayload
  | UserRoleAssignedPayload
  | UserRoleRemovedPayload
  | RolePermissionsUpdatedPayload
  | AccessGraphRebuiltPayload;

// ════════════════════════════════════
// EVENT BUS (synchronous, in-memory)
// ════════════════════════════════════

type IAMEventListener<T extends IAMDomainEvent = IAMDomainEvent> = (event: T) => void;

const globalListeners = new Set<IAMEventListener>();
const typedListeners = new Map<IAMEventType, Set<IAMEventListener<any>>>();

/** Subscribe to ALL IAM domain events. */
export function onIAMEvent(listener: IAMEventListener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

/** Subscribe to a specific IAM event type. */
export function onIAMEventType<T extends IAMDomainEvent>(
  type: T['type'],
  listener: IAMEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => { typedListeners.get(type)?.delete(listener); };
}

/** Emit an IAM domain event. */
export function emitIAMEvent(event: IAMDomainEvent): void {
  for (const l of globalListeners) {
    try { l(event); } catch { /* swallow */ }
  }
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const l of typed) {
      try { l(event); } catch { /* swallow */ }
    }
  }
  // Auto-log
  eventLog.unshift(event);
  if (eventLog.length > MAX_LOG) eventLog.pop();
}

// ════════════════════════════════════
// EVENT LOG (debugging)
// ════════════════════════════════════

const MAX_LOG = 100;
const eventLog: IAMDomainEvent[] = [];

export function getIAMEventLog(): ReadonlyArray<IAMDomainEvent> {
  return eventLog;
}

export function clearIAMEventLog(): void {
  eventLog.length = 0;
}
