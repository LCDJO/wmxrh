/**
 * GovernanceCoreEngine — Base Aggregate Entity
 *
 * All domain aggregates extend this base.
 * Uncommitted events are collected and flushed to the event store on persist.
 */

import type { GovernanceDomainEvent } from '../events/governance-domain-event';

export abstract class GovernanceAggregate {
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  private _uncommittedEvents: GovernanceDomainEvent[] = [];
  private _version = 0;

  constructor(aggregateType: string, aggregateId: string) {
    this.aggregate_type = aggregateType;
    this.aggregate_id = aggregateId;
  }

  get version(): number {
    return this._version;
  }

  /** Apply an event: mutate state + collect for persistence */
  protected apply(event: GovernanceDomainEvent): void {
    this.when(event);
    this._uncommittedEvents.push(event);
    this._version++;
  }

  /** State mutation — implemented by concrete aggregates */
  protected abstract when(event: GovernanceDomainEvent): void;

  /** Replay historical events (no collection) */
  rehydrate(events: GovernanceDomainEvent[]): void {
    for (const e of events) {
      this.when(e);
      this._version++;
    }
  }

  /** Drain uncommitted events after persistence */
  getUncommittedEvents(): GovernanceDomainEvent[] {
    return [...this._uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }
}
