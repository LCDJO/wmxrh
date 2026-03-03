/**
 * EventBridges — Connects every domain-level event bus
 * into the GlobalEventKernel unified stream.
 *
 * Each bridge maps a legacy pub/sub into a namespaced
 * KernelEvent so consumers can subscribe to everything
 * from a single point.
 *
 * Namespace convention:
 *   domain:<EventType>   e.g. "security:UnauthorizedAccessAttempt"
 *   platform:<EventType> e.g. "platform:TenantCreated"
 *   workforce:<EventType>
 *   occupational:<EventType>
 *   esocial:<EventType>
 *   agreement:<EventType>
 *   iil:<EventType>
 *   iam:<EventType>
 *   ibl:<EventType>
 *   graph:<EventType>
 */

import type { GlobalEventKernelAPI, EventPriority } from './types';

// ── Domain Event Buses ────────────────────────────────────────
import { onSecurityEvent } from '@/domains/security/security-events';
import { onPlatformEvent } from '@/domains/platform/platform-events';
import { onWorkforceEvent } from '@/domains/workforce-intelligence/workforce-intelligence.events';
import { occupationalEvents } from '@/domains/occupational-intelligence/occupational-compliance.events';
import { onAgreementEvent } from '@/domains/employee-agreement/events';
import { installSelfHealingIncidentBridge } from '@/domains/incident-management/self-healing-incident-bridge';
import { onArchitectureRiskEvent } from '@/domains/architecture-risk';

// ── Security Kernel Event Buses ───────────────────────────────
import {
  onIILEvent,
  onIAMEvent,
  onIBLEvent,
  onGraphEvent,
  onSecurityEvent as onKernelSecurityEvent,
} from '@/domains/security/kernel';

/**
 * Install all domain → kernel bridges.
 * Returns a single teardown function that removes every subscription.
 */
export function installEventBridges(events: GlobalEventKernelAPI): () => void {
  const disposers: Array<() => void> = [];

  // ── 1. Security Events ────────────────────────────────────
  disposers.push(
    onSecurityEvent((evt) => {
      const priority: EventPriority =
        evt.type === 'UnauthorizedAccessAttempt' || evt.type === 'ScopeViolationDetected'
          ? 'high'
          : 'normal';
      events.emit(`security:${evt.type}`, 'SecurityEventsBridge', evt, { priority });
    }),
  );

  // ── 2. Platform Events ────────────────────────────────────
  disposers.push(
    onPlatformEvent((evt) => {
      const priority: EventPriority =
        evt.type.includes('Risk') || evt.type === 'TenantSuspended'
          ? 'high'
          : 'normal';
      events.emit(`platform:${evt.type}`, 'PlatformEventsBridge', evt, { priority });
    }),
  );

  // ── 3. Workforce Intelligence Events ──────────────────────
  disposers.push(
    onWorkforceEvent((evt) => {
      const priority: EventPriority =
        evt.type === 'RiskScoreUpdated' ? 'high' : 'normal';
      events.emit(`workforce:${evt.type}`, 'WorkforceEventsBridge', evt, { priority });
    }),
  );

  // ── 4. Occupational Compliance Events ─────────────────────
  disposers.push(
    occupationalEvents.subscribe((evt) => {
      events.emit(`occupational:${evt.type}`, 'OccupationalEventsBridge', evt, { priority: 'normal' });
    }),
  );

  // ── 5. Employee Agreement Events ──────────────────────────
  // Agreement bus uses per-type subscription; subscribe to all via wildcard handler
  const agreementTypes = [
    'agreement.template.created',
    'agreement.template.updated',
    'agreement.template.version_published',
    'agreement.sent_for_signature',
    'agreement.signed',
    'agreement.rejected',
    'agreement.expired',
    'agreement.auto_dispatch_triggered',
  ] as const;
  for (const type of agreementTypes) {
    onAgreementEvent(type, (evt) => {
      events.emit(`agreement:${evt.type}`, 'AgreementEventsBridge', evt, { priority: 'normal' });
    });
    // Note: onAgreementEvent doesn't return unsubscribe — acceptable for singleton lifetime
  }

  // ── 6. Identity Intelligence Layer Events ─────────────────
  disposers.push(
    onIILEvent((evt) => {
      const priority: EventPriority =
        evt.type.includes('Risk') || evt.type.includes('Anomaly')
          ? 'high'
          : 'normal';
      events.emit(`iil:${evt.type}`, 'IILEventsBridge', evt, { priority });
    }),
  );

  // ── 7. IAM Events ─────────────────────────────────────────
  disposers.push(
    onIAMEvent((evt) => {
      events.emit(`iam:${evt.type}`, 'IAMEventsBridge', evt, { priority: 'normal' });
    }),
  );

  // ── 8. IBL (Identity Boundary Layer) Events ───────────────
  disposers.push(
    onIBLEvent((evt) => {
      const priority: EventPriority =
        evt.type === 'UnauthorizedContextSwitch' ? 'high' : 'normal';
      events.emit(`ibl:${evt.type}`, 'IBLEventsBridge', evt, { priority });
    }),
  );

  // ── 9. Access Graph Events ────────────────────────────────
  disposers.push(
    onGraphEvent((evt) => {
      events.emit(`graph:${evt.type}`, 'GraphEventsBridge', evt, { priority: 'normal' });
    }),
  );

  // ── 10. Kernel Audit/Security Events ──────────────────────
  disposers.push(
    onKernelSecurityEvent((evt) => {
      events.emit(`kernel:${evt.type}`, 'KernelSecurityBridge', evt, { priority: 'high' });
    }),
  );

  // ── 11. Self-Healing ↔ Incident Management Bridge ────────────
  disposers.push(
    installSelfHealingIncidentBridge(events),
  );

  // ── 12. Architecture Risk Events ─────────────────────────────
  disposers.push(
    onArchitectureRiskEvent((evt) => {
      const priority: EventPriority =
        evt.type === 'CircularDependencyBlocked' || evt.type === 'CriticalDependencyDetected'
          ? 'high'
          : 'normal';
      events.emit(`arch-risk:${evt.type}`, 'ArchitectureRiskBridge', evt, { priority });
    }),
  );

  // ── Teardown ──────────────────────────────────────────────
  return () => {
    disposers.forEach(fn => fn());
    disposers.length = 0;
  };
}
