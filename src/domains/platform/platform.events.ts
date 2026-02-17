/**
 * Platform Domain Events
 *
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  Typed domain events emitted by the Platform Admin layer:      ║
 * ║                                                                ║
 * ║  1. PlatformRoleCreated          → new platform role created   ║
 * ║  2. PlatformRoleUpdated          → platform role modified      ║
 * ║  3. PlatformPermissionAssigned   → permission bound to role    ║
 * ║  4. PlatformPermissionRevoked    → permission unbound          ║
 * ║  5. PlatformAccessGraphRebuilt   → graph cache invalidated     ║
 * ║                                                                ║
 * ║  Pure data — NO UI, NO side-effects inside this file.          ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

import type { PlatformRoleType } from './PlatformGuard';

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type PlatformEventType =
  | 'PlatformRoleCreated'
  | 'PlatformRoleUpdated'
  | 'PlatformPermissionAssigned'
  | 'PlatformPermissionRevoked'
  | 'PlatformAccessGraphRebuilt';

// ── Payloads ──

export interface PlatformRoleCreatedPayload {
  type: 'PlatformRoleCreated';
  timestamp: number;
  role_id: string;
  role_slug: string;
  role_name: string;
  is_system_role: boolean;
  inherits_role_ids: string[];
  created_by: string;
}

export interface PlatformRoleUpdatedPayload {
  type: 'PlatformRoleUpdated';
  timestamp: number;
  role_id: string;
  role_slug: string;
  changes: {
    field: string;
    old_value: unknown;
    new_value: unknown;
  }[];
  updated_by: string;
}

export interface PlatformPermissionAssignedPayload {
  type: 'PlatformPermissionAssigned';
  timestamp: number;
  role_id: string;
  role_slug: string;
  permission_id: string;
  permission_code: string;
  assigned_by: string;
}

export interface PlatformPermissionRevokedPayload {
  type: 'PlatformPermissionRevoked';
  timestamp: number;
  role_id: string;
  role_slug: string;
  permission_id: string;
  permission_code: string;
  revoked_by: string;
}

export interface PlatformAccessGraphRebuiltPayload {
  type: 'PlatformAccessGraphRebuilt';
  timestamp: number;
  user_id: string | null;
  reason: PlatformEventType;
  effective_roles_count: number;
  effective_permissions_count: number;
}

// ── Union ──

export type PlatformDomainEvent =
  | PlatformRoleCreatedPayload
  | PlatformRoleUpdatedPayload
  | PlatformPermissionAssignedPayload
  | PlatformPermissionRevokedPayload
  | PlatformAccessGraphRebuiltPayload;

// ════════════════════════════════════
// EVENT BUS (synchronous, in-memory)
// ════════════════════════════════════

type PlatformEventListener<T extends PlatformDomainEvent = PlatformDomainEvent> = (event: T) => void;

const globalListeners = new Set<PlatformEventListener>();
const typedListeners = new Map<PlatformEventType, Set<PlatformEventListener<any>>>();

/** Subscribe to ALL platform domain events. */
export function onPlatformEvent(listener: PlatformEventListener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

/** Subscribe to a specific platform event type. */
export function onPlatformEventType<T extends PlatformDomainEvent>(
  type: T['type'],
  listener: PlatformEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => { typedListeners.get(type)?.delete(listener); };
}

/** Emit a platform domain event. */
export function emitPlatformEvent(event: PlatformDomainEvent): void {
  for (const l of globalListeners) {
    try { l(event); } catch { /* swallow */ }
  }
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const l of typed) {
      try { l(event); } catch { /* swallow */ }
    }
  }
  eventLog.unshift(event);
  if (eventLog.length > MAX_LOG) eventLog.pop();
}

// ════════════════════════════════════
// EVENT LOG (debugging)
// ════════════════════════════════════

const MAX_LOG = 100;
const eventLog: PlatformDomainEvent[] = [];

export function getPlatformEventLog(): ReadonlyArray<PlatformDomainEvent> {
  return eventLog;
}

export function clearPlatformEventLog(): void {
  eventLog.length = 0;
}

export const __DOMAIN_CATALOG = {
  domain: 'Platform IAM',
  color: 'hsl(260 55% 52%)',
  events: [
    { name: 'PlatformRoleCreated', description: 'Role de plataforma criada' },
    { name: 'PlatformRoleUpdated', description: 'Role de plataforma atualizada' },
    { name: 'PlatformPermissionAssigned', description: 'Permissão de plataforma atribuída' },
    { name: 'PlatformPermissionRevoked', description: 'Permissão de plataforma revogada' },
    { name: 'PlatformAccessGraphRebuilt', description: 'Grafo de acesso da plataforma reconstruído' },
  ],
};
