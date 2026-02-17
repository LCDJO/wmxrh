/**
 * SecurityKernel — Access Graph Events
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TYPED EVENT SYSTEM FOR GRAPH RECONSTRUCTION                    ║
 * ║                                                                  ║
 * ║  Events that trigger graph rebuild:                              ║
 * ║    • UserRoleChanged   — user_roles insert/update/delete         ║
 * ║    • ScopeAssigned     — new scope added to user                 ║
 * ║    • ScopeRevoked      — scope removed from user                 ║
 * ║    • CompanyCreated    — new company in tenant                   ║
 * ║    • GroupUpdated      — group modified/created/deleted           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { accessGraphCache, type CacheInvalidationReason } from './access-graph.cache';

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type GraphEventType =
  | 'UserRoleChanged'
  | 'ScopeAssigned'
  | 'ScopeRevoked'
  | 'CompanyCreated'
  | 'CompanyRemoved'
  | 'GroupUpdated'
  | 'GroupCreated'
  | 'GroupRemoved';

export interface GraphEvent {
  type: GraphEventType;
  tenant_id: string;
  /** User affected (null = all users in tenant) */
  user_id: string | null;
  /** The entity that changed */
  entity: {
    type: 'user_role' | 'tenant_membership' | 'company' | 'company_group';
    id: string;
  };
  /** What happened */
  action: 'insert' | 'update' | 'delete';
  timestamp: number;
  /** Extra context */
  meta?: Record<string, unknown>;
}

// ════════════════════════════════════
// EVENT → INVALIDATION MAPPING
// ════════════════════════════════════

const EVENT_TO_REASON: Record<GraphEventType, CacheInvalidationReason> = {
  UserRoleChanged: 'ROLE_CHANGED',
  ScopeAssigned: 'SCOPE_CHANGED',
  ScopeRevoked: 'SCOPE_CHANGED',
  CompanyCreated: 'COMPANY_CHANGED',
  CompanyRemoved: 'COMPANY_CHANGED',
  GroupUpdated: 'GROUP_CHANGED',
  GroupCreated: 'GROUP_CHANGED',
  GroupRemoved: 'GROUP_CHANGED',
};

/** Events that affect a single user */
const USER_SCOPED_EVENTS: GraphEventType[] = [
  'UserRoleChanged',
  'ScopeAssigned',
  'ScopeRevoked',
];

/** Events that affect ALL users in a tenant */
const TENANT_SCOPED_EVENTS: GraphEventType[] = [
  'CompanyCreated',
  'CompanyRemoved',
  'GroupUpdated',
  'GroupCreated',
  'GroupRemoved',
];

// ════════════════════════════════════
// LISTENERS
// ════════════════════════════════════

type GraphEventListener = (event: GraphEvent) => void;
const listeners: GraphEventListener[] = [];
const eventLog: GraphEvent[] = [];
const MAX_LOG_SIZE = 200;

// ════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════

/**
 * Emit a graph event. Automatically invalidates the correct cache entries
 * and notifies listeners.
 * 
 * @example
 * // When a user_role is inserted:
 * emitGraphEvent({
 *   type: 'UserRoleChanged',
 *   tenant_id: tenantId,
 *   user_id: userId,
 *   entity: { type: 'user_role', id: roleId },
 *   action: 'insert',
 * });
 * 
 * // When a company is created (affects all users):
 * emitGraphEvent({
 *   type: 'CompanyCreated',
 *   tenant_id: tenantId,
 *   user_id: null,
 *   entity: { type: 'company', id: companyId },
 *   action: 'insert',
 * });
 */
export function emitGraphEvent(event: Omit<GraphEvent, 'timestamp'>): void {
  const fullEvent: GraphEvent = {
    ...event,
    timestamp: Date.now(),
  };

  // Log
  eventLog.push(fullEvent);
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.splice(0, eventLog.length - MAX_LOG_SIZE);
  }

  // Invalidate cache
  const reason = EVENT_TO_REASON[fullEvent.type];
  const triggeredBy = {
    entity: fullEvent.entity.type,
    entityId: fullEvent.entity.id,
    action: fullEvent.action,
  };

  if (USER_SCOPED_EVENTS.includes(fullEvent.type) && fullEvent.user_id) {
    // Invalidate specific user's cache
    accessGraphCache.invalidate(fullEvent.user_id, fullEvent.tenant_id, reason, triggeredBy);
  } else if (TENANT_SCOPED_EVENTS.includes(fullEvent.type)) {
    // Invalidate ALL users in this tenant
    accessGraphCache.invalidateTenant(fullEvent.tenant_id, reason, triggeredBy);
  }

  // Notify listeners
  for (const listener of listeners) {
    try {
      listener(fullEvent);
    } catch {
      // Swallow listener errors
    }
  }
}

/**
 * Subscribe to graph events.
 * Returns an unsubscribe function.
 */
export function onGraphEvent(listener: GraphEventListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Get recent graph events (for debugging/admin).
 */
export function getGraphEventLog(limit = 50): readonly GraphEvent[] {
  return eventLog.slice(-limit);
}

/**
 * Clear the event log.
 */
export function clearGraphEventLog(): void {
  eventLog.length = 0;
}

// ════════════════════════════════════
// CONVENIENCE EMITTERS
// ════════════════════════════════════

export const graphEvents = {
  userRoleChanged(tenantId: string, userId: string, roleId: string, action: 'insert' | 'update' | 'delete') {
    emitGraphEvent({
      type: 'UserRoleChanged',
      tenant_id: tenantId,
      user_id: userId,
      entity: { type: 'user_role', id: roleId },
      action,
    });
  },

  scopeAssigned(tenantId: string, userId: string, membershipId: string) {
    emitGraphEvent({
      type: 'ScopeAssigned',
      tenant_id: tenantId,
      user_id: userId,
      entity: { type: 'tenant_membership', id: membershipId },
      action: 'insert',
    });
  },

  scopeRevoked(tenantId: string, userId: string, membershipId: string) {
    emitGraphEvent({
      type: 'ScopeRevoked',
      tenant_id: tenantId,
      user_id: userId,
      entity: { type: 'tenant_membership', id: membershipId },
      action: 'delete',
    });
  },

  companyCreated(tenantId: string, companyId: string) {
    emitGraphEvent({
      type: 'CompanyCreated',
      tenant_id: tenantId,
      user_id: null,
      entity: { type: 'company', id: companyId },
      action: 'insert',
    });
  },

  companyRemoved(tenantId: string, companyId: string) {
    emitGraphEvent({
      type: 'CompanyRemoved',
      tenant_id: tenantId,
      user_id: null,
      entity: { type: 'company', id: companyId },
      action: 'delete',
    });
  },

  groupUpdated(tenantId: string, groupId: string, action: 'insert' | 'update' | 'delete' = 'update') {
    const type: GraphEventType = action === 'insert' ? 'GroupCreated' : action === 'delete' ? 'GroupRemoved' : 'GroupUpdated';
    emitGraphEvent({
      type,
      tenant_id: tenantId,
      user_id: null,
      entity: { type: 'company_group', id: groupId },
      action,
    });
  },
};

export const __DOMAIN_CATALOG = {
  domain: 'Access Graph',
  color: 'hsl(340 60% 52%)',
  events: [
    { name: 'UserRoleChanged', description: 'Role do usuário alterada no grafo' },
    { name: 'ScopeAssigned', description: 'Escopo atribuído' },
    { name: 'ScopeRevoked', description: 'Escopo revogado' },
    { name: 'CompanyCreated', description: 'Empresa criada no grafo' },
    { name: 'CompanyRemoved', description: 'Empresa removida do grafo' },
    { name: 'GroupCreated', description: 'Grupo criado no grafo' },
    { name: 'GroupUpdated', description: 'Grupo atualizado no grafo' },
    { name: 'GroupRemoved', description: 'Grupo removido do grafo' },
  ],
};
