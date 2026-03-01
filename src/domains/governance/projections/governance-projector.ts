/**
 * GovernanceCoreEngine — Projector
 *
 * Subscribes to domain events and maintains read-model projections.
 * Each projector function handles a specific event type and updates
 * the projection store accordingly.
 */

import { onGovernanceEvent, onAnyGovernanceEvent } from '../events/governance-event-bus';
import { GovernanceProjectionStore } from '../repositories/governance-projection-store';
import type { GovernanceDomainEvent } from '../events/governance-domain-event';

const projectionStore = new GovernanceProjectionStore();

export interface ProjectorRegistration {
  event_type: string;
  projection_name: string;
  handler: (event: GovernanceDomainEvent, store: GovernanceProjectionStore) => Promise<void>;
}

const registrations: ProjectorRegistration[] = [];

/** Register a projector for a specific event type. */
export function registerProjector(reg: ProjectorRegistration): void {
  registrations.push(reg);
  onGovernanceEvent(reg.event_type, (event) => reg.handler(event, projectionStore));
}

/** Built-in: activity timeline projector (tracks last N events per aggregate). */
export function initCoreProjectors(): void {
  onAnyGovernanceEvent(async (event) => {
    const tenantId = event.metadata.tenant_id;
    if (!tenantId) return;

    const existing = await projectionStore.load(tenantId, 'activity_timeline', event.aggregate_type, event.aggregate_id);
    const timeline = ((existing?.state?.events as unknown[]) ?? []) as Array<{
      event_type: string;
      occurred_at: string;
      actor_id?: string;
    }>;

    timeline.push({
      event_type: event.event_type,
      occurred_at: event.occurred_at,
      actor_id: event.metadata.actor_id,
    });

    // Keep last 50 entries
    if (timeline.length > 50) timeline.splice(0, timeline.length - 50);

    await projectionStore.save({
      tenant_id: tenantId,
      projection_name: 'activity_timeline',
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      state: { events: timeline, count: timeline.length },
      version: (existing?.version ?? 0) + 1,
      last_event_id: event.id,
    });
  });
}
