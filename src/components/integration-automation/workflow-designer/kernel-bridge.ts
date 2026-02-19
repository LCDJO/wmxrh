/**
 * Kernel Bridge — Connects the Event Trigger Registry
 * to the GlobalEventKernel so workflow triggers fire
 * when real domain events are emitted.
 */

import type { GlobalEventKernelAPI } from '@/domains/platform-os/types';
import { EVENT_TRIGGER_REGISTRY, type EventTriggerDef } from './event-trigger-registry';

export interface KernelBridgeHandle {
  /** Active subscriptions count */
  subscriptionCount: number;
  /** Tear down all subscriptions */
  destroy: () => void;
}

type WorkflowTriggerCallback = (trigger: EventTriggerDef, payload: unknown) => void;

/**
 * Subscribe to ALL registered domain events on the GlobalEventKernel.
 * When a matching event fires, invokes the callback which the workflow
 * execution engine uses to start workflow runs.
 */
export function bridgeKernelToWorkflows(
  kernel: GlobalEventKernelAPI,
  onTrigger: WorkflowTriggerCallback,
): KernelBridgeHandle {
  const unsubscribers: (() => void)[] = [];

  for (const trigger of EVENT_TRIGGER_REGISTRY) {
    const unsub = kernel.on(trigger.eventType, (event) => {
      onTrigger(trigger, event.payload);
    }, { priority: 'normal', source_filter: undefined });
    unsubscribers.push(unsub);
  }

  return {
    subscriptionCount: unsubscribers.length,
    destroy: () => unsubscribers.forEach(fn => fn()),
  };
}
