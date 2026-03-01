/**
 * GovernanceCoreEngine — Query Service
 *
 * Read-side: queries projections and event streams.
 * No mutations — pure reads.
 */

import { GovernanceEventStore } from '../repositories/governance-event-store';
import { GovernanceProjectionStore, type ProjectionRecord } from '../repositories/governance-projection-store';
import type { GovernanceDomainEvent } from '../events/governance-domain-event';

export class GovernanceQueryService {
  private eventStore = new GovernanceEventStore();
  private projectionStore = new GovernanceProjectionStore();

  /** Get current projected state for an aggregate. */
  async getProjection(
    tenantId: string,
    aggregateType: string,
    aggregateId: string,
  ): Promise<ProjectionRecord | null> {
    return this.projectionStore.load(tenantId, 'latest_state', aggregateType, aggregateId);
  }

  /** List all projections of a given type (e.g. all employee states). */
  async listProjections(
    tenantId: string,
    projectionName: string,
    opts?: { limit?: number },
  ): Promise<ProjectionRecord[]> {
    return this.projectionStore.listByProjection(tenantId, projectionName, opts);
  }

  /** Full event history for an aggregate (replay). */
  async getEventStream(
    tenantId: string,
    aggregateType: string,
    aggregateId: string,
  ): Promise<GovernanceDomainEvent[]> {
    return this.eventStore.loadStream(tenantId, aggregateType, aggregateId);
  }

  /** Query events by type (cross-aggregate). */
  async getEventsByType(
    tenantId: string,
    eventType: string,
    opts?: { limit?: number; after?: string },
  ): Promise<GovernanceDomainEvent[]> {
    return this.eventStore.queryByType(tenantId, eventType, opts);
  }

  /** Get the full audit trail for a tenant (paginated). */
  async getAuditTrail(
    tenantId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<GovernanceDomainEvent[]> {
    return this.eventStore.queryAll(tenantId, opts);
  }
}
