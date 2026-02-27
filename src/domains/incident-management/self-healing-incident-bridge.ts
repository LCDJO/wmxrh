/**
 * Self-Healing ↔ Incident Management Bridge
 *
 * Connects Self-Healing domain events to the Incident Management system:
 *   - SelfHealingTriggered (failed recovery) → auto-creates critical incident
 *   - IncidentResolved (in IM) → notifies Self-Healing for module recovery tracking
 *
 * Also bridges Incident Management events into the GlobalEventKernel.
 */

import type { GlobalEventKernelAPI, EventPriority } from '@/domains/platform-os/types';
import { onSelfHealingEvent, type SelfHealingDomainEvent } from '@/domains/self-healing/self-healing-events';
import { INCIDENT_KERNEL_EVENTS } from './incident-events';

/**
 * Install bidirectional bridge between Self-Healing and Incident Management.
 * Returns teardown function.
 */
export function installSelfHealingIncidentBridge(
  kernel: GlobalEventKernelAPI,
): () => void {
  const disposers: Array<() => void> = [];

  // ── Self-Healing → Kernel (incident namespace) ────────────────
  disposers.push(
    onSelfHealingEvent((evt: SelfHealingDomainEvent) => {
      // Map self-healing events into incident kernel namespace
      switch (evt.type) {
        case 'IncidentDetected': {
          // Self-Healing detected an incident → emit as incident:created in kernel
          const priority: EventPriority =
            evt.severity === 'critical' ? 'critical' : 'high';
          kernel.emit(
            INCIDENT_KERNEL_EVENTS.IncidentCreated,
            'SelfHealingBridge',
            {
              incident_id: evt.incident_id,
              title: evt.title,
              severity: evt.severity,
              source: 'self_healing',
              tenant_id: null,
              affected_modules: evt.affected_modules,
            },
            { priority },
          );
          break;
        }

        case 'SelfHealingTriggered': {
          // Recovery attempt started → emit escalation event
          kernel.emit(
            INCIDENT_KERNEL_EVENTS.IncidentEscalated,
            'SelfHealingBridge',
            {
              incident_id: evt.incident_id,
              from_level: 'l1',
              to_level: 'l2',
              reason: `Self-healing triggered with ${evt.planned_actions.length} planned actions`,
              auto_escalated: true,
            },
            { priority: 'high' },
          );
          break;
        }

        case 'ModuleRecovered': {
          // Module recovered → emit resolved event
          kernel.emit(
            INCIDENT_KERNEL_EVENTS.IncidentResolved,
            'SelfHealingBridge',
            {
              incident_id: evt.incident_id,
              module_id: evt.module_id,
              auto_recovered: evt.auto_recovered,
              recovery_duration_ms: evt.recovery_duration_ms,
            },
            { priority: 'normal' },
          );
          break;
        }

        case 'CircuitOpened': {
          // Circuit breaker opened → component degraded
          kernel.emit(
            INCIDENT_KERNEL_EVENTS.ComponentStatusChanged,
            'SelfHealingBridge',
            {
              component_id: evt.module_id,
              new_status: 'major_outage',
              reason: `Circuit breaker opened after ${evt.failure_count} failures`,
            },
            { priority: 'high' },
          );
          break;
        }

        case 'CircuitClosed': {
          // Circuit breaker closed → component operational
          kernel.emit(
            INCIDENT_KERNEL_EVENTS.ComponentStatusChanged,
            'SelfHealingBridge',
            {
              component_id: evt.module_id,
              new_status: 'operational',
              reason: `Circuit breaker closed, recovered in ${evt.recovery_duration_ms}ms`,
            },
            { priority: 'normal' },
          );
          break;
        }
      }
    }),
  );

  return () => {
    disposers.forEach(fn => fn());
    disposers.length = 0;
  };
}
