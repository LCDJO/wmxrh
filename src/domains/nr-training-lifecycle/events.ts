/**
 * NR Training Lifecycle Engine — Domain Events
 *
 * Events emitted during training lifecycle transitions.
 * Consumed by:
 *   - Labor Compliance (violation creation)
 *   - Workforce Intelligence (risk scoring)
 *   - Employee Agreement (training acknowledgment terms)
 *   - Audit trail
 */

import type {
  TrainingAssignment,
  TrainingCompletion,
  TrainingLifecycleStatus,
  BlockingLevel,
} from './types';

// ═══════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════

export interface TrainingAssignedEvent {
  type: 'TrainingAssigned';
  payload: {
    assignment: TrainingAssignment;
    trigger_source: string;
  };
}

export interface TrainingCompletedEvent {
  type: 'TrainingCompleted';
  payload: {
    assignment_id: string;
    employee_id: string;
    completion: TrainingCompletion;
    expires_at: string | null;
  };
}

export interface TrainingExpiredEvent {
  type: 'TrainingExpired';
  payload: {
    assignment_id: string;
    employee_id: string;
    training_name: string;
    nr_number: number;
    expired_at: string;
    blocking_level: BlockingLevel;
  };
}

export interface TrainingBlockedEvent {
  type: 'TrainingBlocked';
  payload: {
    assignment_id: string;
    employee_id: string;
    training_name: string;
    nr_number: number;
    blocking_level: BlockingLevel;
    reason: string;
  };
}

export interface TrainingRenewalDueEvent {
  type: 'TrainingRenewalDue';
  payload: {
    assignment_id: string;
    employee_id: string;
    training_name: string;
    nr_number: number;
    expires_at: string;
    days_until_expiry: number;
  };
}

export interface TrainingStatusChangedEvent {
  type: 'TrainingStatusChanged';
  payload: {
    assignment_id: string;
    employee_id: string;
    from_status: TrainingLifecycleStatus | null;
    to_status: TrainingLifecycleStatus;
    reason: string | null;
  };
}

export type TrainingLifecycleEventType =
  | TrainingAssignedEvent
  | TrainingCompletedEvent
  | TrainingExpiredEvent
  | TrainingBlockedEvent
  | TrainingRenewalDueEvent
  | TrainingStatusChangedEvent;

// ═══════════════════════════════════════════════════════
// EVENT BUS (in-memory, sync)
// ═══════════════════════════════════════════════════════

type Handler<T> = (event: T) => void;
type EventType = TrainingLifecycleEventType['type'];

const handlers = new Map<EventType, Handler<any>[]>();

export const trainingLifecycleEvents = {
  subscribe<T extends TrainingLifecycleEventType>(
    type: T['type'],
    handler: Handler<T>,
  ): () => void {
    const list = handlers.get(type) ?? [];
    list.push(handler);
    handlers.set(type, list);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  },

  emit<T extends TrainingLifecycleEventType>(event: T): void {
    const list = handlers.get(event.type);
    if (!list) return;
    for (const handler of list) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[TrainingLifecycleEvents] Handler error for ${event.type}:`, err);
      }
    }
  },
};

export const __DOMAIN_CATALOG = {
  domain: 'NR Training',
  color: 'hsl(15 70% 50%)',
  events: [
    { name: 'TrainingAssigned', description: 'Treinamento atribuído ao colaborador' },
    { name: 'TrainingCompleted', description: 'Treinamento concluído' },
    { name: 'TrainingExpired', description: 'Treinamento expirado' },
    { name: 'TrainingBlocked', description: 'Treinamento bloqueado (blocking level)' },
    { name: 'TrainingRenewalDue', description: 'Renovação de treinamento próxima' },
    { name: 'TrainingStatusChanged', description: 'Status do treinamento alterado' },
  ],
};
