/**
 * UsageEventBridge — Connects GlobalEventKernel to UsageCollector
 *
 * Listens to domain events and automatically records usage metrics:
 *
 *  ┌─────────────────────────┬────────────────┬──────────────┐
 *  │ Event                   │ metric_type    │ metric_key   │
 *  ├─────────────────────────┼────────────────┼──────────────┤
 *  │ usage:user_created      │ users          │ active_users │
 *  │ usage:api_call_executed │ api_calls      │ api_calls    │
 *  │ usage:workflow_run      │ executions     │ workflow_runs│
 *  └─────────────────────────┴────────────────┴──────────────┘
 *
 * Integration: GlobalEventKernel → UsageEventBridge → UsageCollector
 */

import type { GlobalEventKernelAPI } from '@/domains/platform-os/types';
import type { UsageCollectorAPI, UsageMetricType } from './types';

// ══════════════════════════════════════════════════════════════════
// Event Constants
// ══════════════════════════════════════════════════════════════════

export const USAGE_EVENTS = {
  /** A user was created (seat count) */
  UserCreated: 'usage:user_created',
  /** An API call was executed */
  APICallExecuted: 'usage:api_call_executed',
  /** A workflow/automation was run */
  WorkflowRun: 'usage:workflow_run',
  /** Storage consumption changed */
  StorageUpdated: 'usage:storage_updated',
} as const;

export type UsageEventType = typeof USAGE_EVENTS[keyof typeof USAGE_EVENTS];

// ══════════════════════════════════════════════════════════════════
// Typed Payloads
// ══════════════════════════════════════════════════════════════════

export interface UserCreatedPayload {
  tenant_id: string;
  module_id?: string;
  user_id: string;
  quantity?: number;
}

export interface APICallExecutedPayload {
  tenant_id: string;
  module_id?: string;
  endpoint: string;
  quantity?: number;
}

export interface WorkflowRunPayload {
  tenant_id: string;
  module_id?: string;
  workflow_id: string;
  execution_time_ms?: number;
  quantity?: number;
}

export interface StorageUpdatedPayload {
  tenant_id: string;
  module_id?: string;
  bytes_delta: number;
}

// ══════════════════════════════════════════════════════════════════
// Event → Metric mapping
// ══════════════════════════════════════════════════════════════════

interface UsageEventMapping {
  event: string;
  metric_key: string;
  metric_type: UsageMetricType;
  extractQuantity: (payload: any) => number;
  extractModuleId: (payload: any) => string | undefined;
  extractTenantId: (payload: any) => string;
}

const EVENT_MAPPINGS: UsageEventMapping[] = [
  {
    event: USAGE_EVENTS.UserCreated,
    metric_key: 'active_users',
    metric_type: 'users',
    extractQuantity: (p: UserCreatedPayload) => p.quantity ?? 1,
    extractModuleId: (p: UserCreatedPayload) => p.module_id,
    extractTenantId: (p: UserCreatedPayload) => p.tenant_id,
  },
  {
    event: USAGE_EVENTS.APICallExecuted,
    metric_key: 'api_calls',
    metric_type: 'api_calls',
    extractQuantity: (p: APICallExecutedPayload) => p.quantity ?? 1,
    extractModuleId: (p: APICallExecutedPayload) => p.module_id,
    extractTenantId: (p: APICallExecutedPayload) => p.tenant_id,
  },
  {
    event: USAGE_EVENTS.WorkflowRun,
    metric_key: 'workflow_runs',
    metric_type: 'executions',
    extractQuantity: (p: WorkflowRunPayload) => p.quantity ?? 1,
    extractModuleId: (p: WorkflowRunPayload) => p.module_id,
    extractTenantId: (p: WorkflowRunPayload) => p.tenant_id,
  },
  {
    event: USAGE_EVENTS.StorageUpdated,
    metric_key: 'storage_mb',
    metric_type: 'storage',
    extractQuantity: (p: StorageUpdatedPayload) => Math.max(0, p.bytes_delta / (1024 * 1024)),
    extractModuleId: (p: StorageUpdatedPayload) => p.module_id,
    extractTenantId: (p: StorageUpdatedPayload) => p.tenant_id,
  },
];

// ══════════════════════════════════════════════════════════════════
// Bridge API
// ══════════════════════════════════════════════════════════════════

export interface UsageEventBridgeAPI {
  /** Start listening to events from GlobalEventKernel */
  start(): void;
  /** Stop listening */
  stop(): void;
  /** Stats: how many events were captured */
  getStats(): { total_captured: number; by_metric: Record<string, number> };
  /** Manually emit a usage event through the kernel */
  emitUserCreated(payload: UserCreatedPayload): void;
  emitAPICallExecuted(payload: APICallExecutedPayload): void;
  emitWorkflowRun(payload: WorkflowRunPayload): void;
  emitStorageUpdated(payload: StorageUpdatedPayload): void;
}

export function createUsageEventBridge(
  events: GlobalEventKernelAPI,
  collector: UsageCollectorAPI,
): UsageEventBridgeAPI {
  const unsubscribers: Array<() => void> = [];
  let totalCaptured = 0;
  const byMetric: Record<string, number> = {};

  function handleEvent(mapping: UsageEventMapping, payload: unknown): void {
    const tenantId = mapping.extractTenantId(payload);
    const moduleId = mapping.extractModuleId(payload);
    const quantity = mapping.extractQuantity(payload);

    if (!tenantId || quantity <= 0) return;

    totalCaptured++;
    byMetric[mapping.metric_key] = (byMetric[mapping.metric_key] ?? 0) + 1;

    // Fire-and-forget: don't block the event bus
    collector.record(tenantId, mapping.metric_key, quantity, {
      module_id: moduleId,
      metric_type: mapping.metric_type,
      source: 'event_bridge',
      metadata: { event: mapping.event, raw_payload: payload },
    }).catch(err => {
      console.error(`[UsageEventBridge] Failed to record ${mapping.metric_key}:`, err);
    });
  }

  return {
    start() {
      for (const mapping of EVENT_MAPPINGS) {
        const unsub = events.on(mapping.event, (event) => {
          handleEvent(mapping, event.payload);
        });
        unsubscribers.push(unsub);
      }

      events.emit('billing:usage_bridge_started', 'UsageEventBridge', {
        tracked_events: EVENT_MAPPINGS.map(m => m.event),
      });
    },

    stop() {
      for (const unsub of unsubscribers) unsub();
      unsubscribers.length = 0;

      events.emit('billing:usage_bridge_stopped', 'UsageEventBridge', {
        total_captured: totalCaptured,
      });
    },

    getStats() {
      return { total_captured: totalCaptured, by_metric: { ...byMetric } };
    },

    // ── Convenience emitters ──────────────────────────────────
    emitUserCreated(payload) {
      events.emit(USAGE_EVENTS.UserCreated, 'UsageEventBridge', payload);
    },
    emitAPICallExecuted(payload) {
      events.emit(USAGE_EVENTS.APICallExecuted, 'UsageEventBridge', payload);
    },
    emitWorkflowRun(payload) {
      events.emit(USAGE_EVENTS.WorkflowRun, 'UsageEventBridge', payload);
    },
    emitStorageUpdated(payload) {
      events.emit(USAGE_EVENTS.StorageUpdated, 'UsageEventBridge', payload);
    },
  };
}
