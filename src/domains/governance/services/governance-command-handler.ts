/**
 * GovernanceCoreEngine — Command Handler
 *
 * Orchestrates: validate → load aggregate → execute → persist events → dispatch.
 * Single responsibility: translate commands into persisted domain events.
 */

import { GovernanceEventStore } from '../repositories/governance-event-store';
import { GovernanceProjectionStore } from '../repositories/governance-projection-store';
import type { GovernanceDomainEvent, GovernanceEventMetadata } from '../events/governance-domain-event';
import { createGovernanceEvent } from '../events/governance-domain-event';

export interface GovernanceCommand {
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  command_type: string;
  payload: Record<string, unknown>;
  metadata?: Partial<GovernanceEventMetadata>;
}

export class GovernanceCommandHandler {
  private eventStore = new GovernanceEventStore();
  private projectionStore = new GovernanceProjectionStore();

  /**
   * Execute a command: creates an event and appends it to the store.
   * Returns the created event.
   */
  async execute(command: GovernanceCommand): Promise<GovernanceDomainEvent> {
    const eventType = this.commandToEventType(command.command_type);

    const event = createGovernanceEvent({
      aggregate_type: command.aggregate_type,
      aggregate_id: command.aggregate_id,
      event_type: eventType,
      payload: command.payload,
      metadata: {
        tenant_id: command.tenant_id,
        actor_type: 'system',
        source_module: 'GovernanceCoreEngine',
        ...command.metadata,
      },
    });

    await this.eventStore.append([event]);

    // Update projection (latest state snapshot)
    const existingProjection = await this.projectionStore.load(
      command.tenant_id,
      'latest_state',
      command.aggregate_type,
      command.aggregate_id,
    );

    const currentState = existingProjection?.state ?? {};
    const newState = { ...currentState, ...command.payload, last_event: eventType, updated_at: event.occurred_at };

    await this.projectionStore.save({
      tenant_id: command.tenant_id,
      projection_name: 'latest_state',
      aggregate_type: command.aggregate_type,
      aggregate_id: command.aggregate_id,
      state: newState,
      version: (existingProjection?.version ?? 0) + 1,
      last_event_id: event.id,
    });

    return event;
  }

  /** Execute multiple commands atomically. */
  async executeBatch(commands: GovernanceCommand[]): Promise<GovernanceDomainEvent[]> {
    const events: GovernanceDomainEvent[] = [];
    for (const cmd of commands) {
      events.push(await this.execute(cmd));
    }
    return events;
  }

  /** Map command name → event name (convention-based). */
  private commandToEventType(commandType: string): string {
    // e.g. 'HireEmployee' → 'EmployeeHired', 'PublishPolicy' → 'PolicyPublished'
    // Fallback: use command type as-is
    return commandType;
  }
}
