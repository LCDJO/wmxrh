/**
 * PlanLifecycleManager — Governa transições de estado de planos SaaS
 */

import type {
  PlanLifecycleManagerAPI,
  PlanLifecycleEvent,
  PlanStatus,
  PlanTransition,
} from './types';

const VALID_TRANSITIONS: Record<PlanStatus, PlanTransition[]> = {
  trial: ['activate', 'end_trial', 'cancel'],
  active: ['upgrade', 'downgrade', 'suspend', 'cancel', 'mark_past_due'],
  suspended: ['reactivate', 'cancel'],
  past_due: ['reactivate', 'suspend', 'cancel'],
  cancelled: ['reactivate', 'start_trial'],
};

const TRANSITION_TARGET_STATUS: Record<PlanTransition, PlanStatus> = {
  activate: 'active',
  upgrade: 'active',
  downgrade: 'active',
  suspend: 'suspended',
  cancel: 'cancelled',
  reactivate: 'active',
  start_trial: 'trial',
  end_trial: 'active',
  mark_past_due: 'past_due',
};

export function createPlanLifecycleManager(): PlanLifecycleManagerAPI {
  const histories = new Map<string, PlanLifecycleEvent[]>();
  const statuses = new Map<string, PlanStatus>();

  function getHistory(tenantId: string): PlanLifecycleEvent[] {
    if (!histories.has(tenantId)) histories.set(tenantId, []);
    return histories.get(tenantId)!;
  }

  return {
    transition(tenantId, transition, toPlanId, reason?) {
      const check = this.canTransition(tenantId, transition);
      if (!check.allowed) {
        throw new Error(`[PXE] Transition "${transition}" not allowed for tenant ${tenantId}: ${check.reason}`);
      }

      const currentStatus = statuses.get(tenantId) ?? 'cancelled';
      const history = getHistory(tenantId);
      const lastPlan = history.length > 0 ? history[history.length - 1].to_plan : null;

      const event: PlanLifecycleEvent = {
        tenant_id: tenantId,
        from_plan: lastPlan,
        to_plan: toPlanId,
        transition,
        reason,
        timestamp: Date.now(),
      };

      history.push(event);
      statuses.set(tenantId, TRANSITION_TARGET_STATUS[transition]);

      return event;
    },

    canTransition(tenantId, transition) {
      const current = statuses.get(tenantId) ?? 'cancelled';
      const allowed = VALID_TRANSITIONS[current] ?? [];
      if (!allowed.includes(transition)) {
        return { allowed: false, reason: `Cannot "${transition}" from status "${current}"` };
      }
      return { allowed: true };
    },

    history(tenantId) {
      return [...(histories.get(tenantId) ?? [])];
    },

    currentStatus(tenantId) {
      return statuses.get(tenantId) ?? 'cancelled';
    },
  };
}
