/**
 * GovernanceCoreEngine — Domain Event Types
 *
 * Canonical event envelope for the governance event store.
 * All domain events are immutable value objects.
 */

export interface GovernanceDomainEvent<TPayload = Record<string, unknown>> {
  /** Unique event id */
  id: string;
  /** Aggregate classification (e.g. 'employee', 'policy') */
  aggregate_type: string;
  /** Aggregate instance id */
  aggregate_id: string;
  /** Event name (e.g. 'EmployeeHired', 'PolicyPublished') */
  event_type: string;
  /** Schema version for this event type */
  event_version: number;
  /** Domain-specific payload */
  payload: TPayload;
  /** Cross-cutting metadata */
  metadata: GovernanceEventMetadata;
  /** When the event occurred in the domain */
  occurred_at: string;
}

export interface GovernanceEventMetadata {
  tenant_id: string;
  correlation_id?: string;
  causation_id?: string;
  actor_id?: string;
  actor_type?: 'user' | 'system' | 'automation';
  ip_address?: string;
  user_agent?: string;
  source_module?: string;
  [key: string]: unknown;
}

/** Helper: create a well-formed domain event */
export function createGovernanceEvent<T extends Record<string, unknown>>(
  params: {
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    event_version?: number;
    payload: T;
    metadata: GovernanceEventMetadata;
  },
): GovernanceDomainEvent<T> {
  return {
    id: `gev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    aggregate_type: params.aggregate_type,
    aggregate_id: params.aggregate_id,
    event_type: params.event_type,
    event_version: params.event_version ?? 1,
    payload: params.payload,
    metadata: params.metadata,
    occurred_at: new Date().toISOString(),
  };
}
