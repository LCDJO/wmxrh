/**
 * GovernanceCoreEngine — Public API Facade
 *
 * Single entry point for the governance bounded context.
 * Composes command handler, query service, event bus, and projectors.
 *
 * Architecture:
 *   Command → CommandHandler → EventStore (append-only) → EventBus → Projectors
 *   Query   → QueryService   → ProjectionStore | EventStore
 */

import { GovernanceCommandHandler, type GovernanceCommand } from '../services/governance-command-handler';
import { GovernanceQueryService } from '../services/governance-query-service';
import { initCoreProjectors } from '../projections/governance-projector';
import type { GovernanceDomainEvent } from '../events/governance-domain-event';
import type { ProjectionRecord } from '../repositories/governance-projection-store';

export interface GovernanceCoreEngineAPI {
  // ── Commands (write) ──
  execute(command: GovernanceCommand): Promise<GovernanceDomainEvent>;
  executeBatch(commands: GovernanceCommand[]): Promise<GovernanceDomainEvent[]>;

  // ── Queries (read) ──
  getProjection(tenantId: string, aggregateType: string, aggregateId: string): Promise<ProjectionRecord | null>;
  listProjections(tenantId: string, projectionName: string, opts?: { limit?: number }): Promise<ProjectionRecord[]>;
  getEventStream(tenantId: string, aggregateType: string, aggregateId: string): Promise<GovernanceDomainEvent[]>;
  getEventsByType(tenantId: string, eventType: string, opts?: { limit?: number; after?: string }): Promise<GovernanceDomainEvent[]>;
  getAuditTrail(tenantId: string, opts?: { limit?: number; offset?: number }): Promise<GovernanceDomainEvent[]>;
}

export class GovernanceCoreEngine implements GovernanceCoreEngineAPI {
  private commandHandler = new GovernanceCommandHandler();
  private queryService = new GovernanceQueryService();
  private _initialized = false;

  /** Idempotent initialization — call once at app startup. */
  init(): void {
    if (this._initialized) return;
    initCoreProjectors();
    this._initialized = true;
  }

  // ── Commands ──

  async execute(command: GovernanceCommand): Promise<GovernanceDomainEvent> {
    return this.commandHandler.execute(command);
  }

  async executeBatch(commands: GovernanceCommand[]): Promise<GovernanceDomainEvent[]> {
    return this.commandHandler.executeBatch(commands);
  }

  // ── Queries ──

  async getProjection(tenantId: string, aggregateType: string, aggregateId: string) {
    return this.queryService.getProjection(tenantId, aggregateType, aggregateId);
  }

  async listProjections(tenantId: string, projectionName: string, opts?: { limit?: number }) {
    return this.queryService.listProjections(tenantId, projectionName, opts);
  }

  async getEventStream(tenantId: string, aggregateType: string, aggregateId: string) {
    return this.queryService.getEventStream(tenantId, aggregateType, aggregateId);
  }

  async getEventsByType(tenantId: string, eventType: string, opts?: { limit?: number; after?: string }) {
    return this.queryService.getEventsByType(tenantId, eventType, opts);
  }

  async getAuditTrail(tenantId: string, opts?: { limit?: number; offset?: number }) {
    return this.queryService.getAuditTrail(tenantId, opts);
  }
}

// ── Singleton ──

let _instance: GovernanceCoreEngine | null = null;

export function getGovernanceCoreEngine(): GovernanceCoreEngine {
  if (!_instance) {
    _instance = new GovernanceCoreEngine();
    _instance.init();
  }
  return _instance;
}
