/**
 * GovernanceCoreEngine — SanctionEngine
 *
 * Manages the full lifecycle of sanctions with status model:
 *   active → restricted → suspended → banned
 *
 * Every sanction action automatically generates:
 *   1. A LegalEvent (append-only, immutable)
 *   2. An AuditLog entry (append-only, immutable)
 *
 * Uses the GovernanceEventStore for event sourcing.
 */

import { GovernanceEventStore } from '../repositories/governance-event-store';
import { createGovernanceEvent, type GovernanceEventMetadata } from '../events/governance-domain-event';
import {
  SANCTION_EVENTS,
  type SanctionAccountStatus,
  type SanctionCreatedPayload,
  type SanctionStatusChangePayload,
  type SanctionEscalatedPayload,
  type SanctionContestedPayload,
  type SanctionRevokedPayload,
} from '../events/sanction-events';

// ── Internal state per entity ──

interface EntitySanctionState {
  entity_id: string;
  entity_type: string;
  status: SanctionAccountStatus;
  active_sanctions: string[];
  total_sanctions: number;
  escalation_level: number;
}

// ── Escalation ladder ──

const STATUS_ESCALATION: SanctionAccountStatus[] = ['active', 'restricted', 'suspended', 'banned'];

function nextStatus(current: SanctionAccountStatus): SanctionAccountStatus {
  const idx = STATUS_ESCALATION.indexOf(current);
  return idx < STATUS_ESCALATION.length - 1 ? STATUS_ESCALATION[idx + 1] : 'banned';
}

export class SanctionEngine {
  private eventStore = new GovernanceEventStore();

  // ══════════════════════════════════════
  // COMMANDS
  // ══════════════════════════════════════

  /**
   * Apply a new sanction to an entity.
   * Automatically determines new status based on escalation.
   */
  async applySanction(
    tenantId: string,
    params: {
      entity_id: string;
      entity_type: 'employee' | 'tenant' | 'user' | 'api_client';
      sanction_type: string;
      reason: string;
      legal_basis?: string;
      severity: string;
      effective_date?: string;
      expiry_date?: string;
      duration_days?: number;
      issued_by: string;
      witness_ids?: string[];
      attachments?: string[];
      notes?: string;
    },
    meta?: Partial<GovernanceEventMetadata>,
  ): Promise<{ sanction_id: string; new_status: SanctionAccountStatus }> {
    const state = await this.loadEntityState(tenantId, params.entity_id);
    const previousStatus = state.status;
    const newStatus = this.determineStatus(params.severity, state);

    const sanctionId = `san_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const baseMeta: GovernanceEventMetadata = {
      tenant_id: tenantId,
      actor_id: params.issued_by,
      actor_type: 'user',
      source_module: 'SanctionEngine',
      ...meta,
    };

    const payload: SanctionCreatedPayload = {
      entity_id: params.entity_id,
      entity_type: params.entity_type,
      sanction_type: params.sanction_type,
      reason: params.reason,
      legal_basis: params.legal_basis ?? null,
      severity: params.severity,
      previous_status: previousStatus,
      new_status: newStatus,
      effective_date: params.effective_date ?? new Date().toISOString(),
      expiry_date: params.expiry_date ?? null,
      duration_days: params.duration_days ?? null,
      issued_by: params.issued_by,
      witness_ids: params.witness_ids ?? [],
      attachments: params.attachments ?? [],
      notes: params.notes ?? null,
    };

    // 1. Sanction event
    const sanctionEvent = createGovernanceEvent({
      aggregate_type: 'sanction',
      aggregate_id: sanctionId,
      event_type: SANCTION_EVENTS.SanctionCreated,
      payload: payload as unknown as Record<string, unknown>,
      metadata: baseMeta,
    });

    // 2. LegalEvent (append-only)
    const legalEvent = createGovernanceEvent({
      aggregate_type: 'legal_event',
      aggregate_id: params.entity_id,
      event_type: SANCTION_EVENTS.LegalEventRecorded,
      payload: {
        sanction_id: sanctionId,
        entity_id: params.entity_id,
        entity_type: params.entity_type,
        category: params.sanction_type,
        severity: params.severity,
        title: `Sanção: ${params.sanction_type}`,
        description: params.reason,
        legal_basis: params.legal_basis ?? null,
        effective_date: payload.effective_date,
        issued_by: params.issued_by,
      },
      metadata: baseMeta,
    });

    // 3. AuditLog (append-only)
    const auditEvent = createGovernanceEvent({
      aggregate_type: 'audit_log',
      aggregate_id: params.entity_id,
      event_type: SANCTION_EVENTS.AuditLogRecorded,
      payload: {
        action: 'sanction_applied',
        sanction_id: sanctionId,
        entity_id: params.entity_id,
        entity_type: params.entity_type,
        sanction_type: params.sanction_type,
        previous_status: previousStatus,
        new_status: newStatus,
        reason: params.reason,
        actor: params.issued_by,
      },
      metadata: baseMeta,
    });

    // 4. Status change event (if status actually changed)
    const events = [sanctionEvent, legalEvent, auditEvent];

    if (newStatus !== previousStatus) {
      const statusEvent = this.createStatusChangeEvent(
        params.entity_id,
        params.entity_type,
        previousStatus,
        newStatus,
        params.reason,
        params.issued_by,
        baseMeta,
      );
      events.push(statusEvent);
    }

    await this.eventStore.append(events);

    return { sanction_id: sanctionId, new_status: newStatus };
  }

  /** Escalate an existing sanction to the next severity level. */
  async escalate(
    tenantId: string,
    params: {
      entity_id: string;
      entity_type: string;
      from_sanction_id: string;
      reason: string;
      escalated_by: string;
    },
    meta?: Partial<GovernanceEventMetadata>,
  ): Promise<{ new_status: SanctionAccountStatus }> {
    const state = await this.loadEntityState(tenantId, params.entity_id);
    const previousStatus = state.status;
    const newStatus = nextStatus(previousStatus);

    const baseMeta: GovernanceEventMetadata = {
      tenant_id: tenantId,
      actor_id: params.escalated_by,
      actor_type: 'user',
      source_module: 'SanctionEngine',
      ...meta,
    };

    const escalationPayload: SanctionEscalatedPayload = {
      entity_id: params.entity_id,
      entity_type: params.entity_type,
      from_sanction_id: params.from_sanction_id,
      previous_level: previousStatus,
      new_level: newStatus,
      reason: params.reason,
      escalated_by: params.escalated_by,
    };

    const events = [
      createGovernanceEvent({
        aggregate_type: 'sanction',
        aggregate_id: params.from_sanction_id,
        event_type: SANCTION_EVENTS.SanctionEscalated,
        payload: escalationPayload as unknown as Record<string, unknown>,
        metadata: baseMeta,
      }),
      createGovernanceEvent({
        aggregate_type: 'legal_event',
        aggregate_id: params.entity_id,
        event_type: SANCTION_EVENTS.LegalEventRecorded,
        payload: {
          sanction_id: params.from_sanction_id,
          entity_id: params.entity_id,
          category: 'escalation',
          severity: newStatus === 'banned' ? 'critical' : 'high',
          title: `Escalação: ${previousStatus} → ${newStatus}`,
          description: params.reason,
          issued_by: params.escalated_by,
        },
        metadata: baseMeta,
      }),
      createGovernanceEvent({
        aggregate_type: 'audit_log',
        aggregate_id: params.entity_id,
        event_type: SANCTION_EVENTS.AuditLogRecorded,
        payload: {
          action: 'sanction_escalated',
          entity_id: params.entity_id,
          from_sanction_id: params.from_sanction_id,
          previous_status: previousStatus,
          new_status: newStatus,
          reason: params.reason,
          actor: params.escalated_by,
        },
        metadata: baseMeta,
      }),
      this.createStatusChangeEvent(params.entity_id, params.entity_type, previousStatus, newStatus, params.reason, params.escalated_by, baseMeta),
    ];

    await this.eventStore.append(events);
    return { new_status: newStatus };
  }

  /** Contest a sanction. */
  async contest(
    tenantId: string,
    params: {
      entity_id: string;
      sanction_id: string;
      contest_reason: string;
      contested_by: string;
      evidence_ids?: string[];
    },
    meta?: Partial<GovernanceEventMetadata>,
  ): Promise<void> {
    const baseMeta: GovernanceEventMetadata = {
      tenant_id: tenantId,
      actor_id: params.contested_by,
      actor_type: 'user',
      source_module: 'SanctionEngine',
      ...meta,
    };

    const contestPayload: SanctionContestedPayload = {
      entity_id: params.entity_id,
      sanction_id: params.sanction_id,
      contest_reason: params.contest_reason,
      contested_by: params.contested_by,
      evidence_ids: params.evidence_ids ?? [],
    };

    await this.eventStore.append([
      createGovernanceEvent({
        aggregate_type: 'sanction',
        aggregate_id: params.sanction_id,
        event_type: SANCTION_EVENTS.SanctionContested,
        payload: contestPayload as unknown as Record<string, unknown>,
        metadata: baseMeta,
      }),
      createGovernanceEvent({
        aggregate_type: 'audit_log',
        aggregate_id: params.entity_id,
        event_type: SANCTION_EVENTS.AuditLogRecorded,
        payload: {
          action: 'sanction_contested',
          sanction_id: params.sanction_id,
          entity_id: params.entity_id,
          reason: params.contest_reason,
          actor: params.contested_by,
        },
        metadata: baseMeta,
      }),
    ]);
  }

  /** Revoke a sanction and restore status. */
  async revoke(
    tenantId: string,
    params: {
      entity_id: string;
      entity_type: string;
      sanction_id: string;
      revocation_reason: string;
      revoked_by: string;
      restore_status?: SanctionAccountStatus;
    },
    meta?: Partial<GovernanceEventMetadata>,
  ): Promise<{ restored_status: SanctionAccountStatus }> {
    const state = await this.loadEntityState(tenantId, params.entity_id);
    const restoreStatus = params.restore_status ?? 'active';

    const baseMeta: GovernanceEventMetadata = {
      tenant_id: tenantId,
      actor_id: params.revoked_by,
      actor_type: 'user',
      source_module: 'SanctionEngine',
      ...meta,
    };

    const revokePayload: SanctionRevokedPayload = {
      entity_id: params.entity_id,
      sanction_id: params.sanction_id,
      revocation_reason: params.revocation_reason,
      revoked_by: params.revoked_by,
      restore_status: restoreStatus,
    };

    const events = [
      createGovernanceEvent({
        aggregate_type: 'sanction',
        aggregate_id: params.sanction_id,
        event_type: SANCTION_EVENTS.SanctionRevoked,
        payload: revokePayload as unknown as Record<string, unknown>,
        metadata: baseMeta,
      }),
      createGovernanceEvent({
        aggregate_type: 'legal_event',
        aggregate_id: params.entity_id,
        event_type: SANCTION_EVENTS.LegalEventRecorded,
        payload: {
          sanction_id: params.sanction_id,
          entity_id: params.entity_id,
          category: 'revocation',
          severity: 'low',
          title: `Sanção revogada`,
          description: params.revocation_reason,
          issued_by: params.revoked_by,
        },
        metadata: baseMeta,
      }),
      createGovernanceEvent({
        aggregate_type: 'audit_log',
        aggregate_id: params.entity_id,
        event_type: SANCTION_EVENTS.AuditLogRecorded,
        payload: {
          action: 'sanction_revoked',
          sanction_id: params.sanction_id,
          entity_id: params.entity_id,
          previous_status: state.status,
          new_status: restoreStatus,
          reason: params.revocation_reason,
          actor: params.revoked_by,
        },
        metadata: baseMeta,
      }),
    ];

    if (state.status !== restoreStatus) {
      events.push(this.createStatusChangeEvent(
        params.entity_id, params.entity_type, state.status, restoreStatus, params.revocation_reason, params.revoked_by, baseMeta,
      ));
    }

    await this.eventStore.append(events);
    return { restored_status: restoreStatus };
  }

  // ══════════════════════════════════════
  // QUERIES
  // ══════════════════════════════════════

  /** Get current sanction state for an entity (rebuilt from events). */
  async getEntityState(tenantId: string, entityId: string): Promise<EntitySanctionState> {
    return this.loadEntityState(tenantId, entityId);
  }

  /** Get all legal events for an entity. */
  async getLegalEvents(tenantId: string, entityId: string) {
    return this.eventStore.loadStream(tenantId, 'legal_event', entityId);
  }

  /** Get audit trail for an entity. */
  async getAuditLog(tenantId: string, entityId: string) {
    return this.eventStore.loadStream(tenantId, 'audit_log', entityId);
  }

  /** Get all sanction events for a specific sanction. */
  async getSanctionHistory(tenantId: string, sanctionId: string) {
    return this.eventStore.loadStream(tenantId, 'sanction', sanctionId);
  }

  // ══════════════════════════════════════
  // INTERNAL
  // ══════════════════════════════════════

  private async loadEntityState(tenantId: string, entityId: string): Promise<EntitySanctionState> {
    // Rebuild state from sanction-related events for this entity
    const legalEvents = await this.eventStore.loadStream(tenantId, 'legal_event', entityId);

    let status: SanctionAccountStatus = 'active';
    const activeSanctions: string[] = [];
    let totalSanctions = 0;
    let escalationLevel = 0;

    // Also check status change events
    const allEvents = await this.eventStore.queryByType(tenantId, SANCTION_EVENTS.AccountRestricted, { limit: 500 });
    const suspendedEvents = await this.eventStore.queryByType(tenantId, SANCTION_EVENTS.AccountSuspended, { limit: 500 });
    const bannedEvents = await this.eventStore.queryByType(tenantId, SANCTION_EVENTS.AccountBanned, { limit: 500 });
    const reactivatedEvents = await this.eventStore.queryByType(tenantId, SANCTION_EVENTS.AccountReactivated, { limit: 500 });

    const statusEvents = [...allEvents, ...suspendedEvents, ...bannedEvents, ...reactivatedEvents]
      .filter(e => (e.payload as Record<string, unknown>).entity_id === entityId)
      .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

    for (const e of statusEvents) {
      const p = e.payload as Record<string, unknown>;
      status = (p.new_status as SanctionAccountStatus) ?? status;
    }

    for (const e of legalEvents) {
      const p = e.payload as Record<string, unknown>;
      if (p.sanction_id) {
        activeSanctions.push(p.sanction_id as string);
        totalSanctions++;
      }
    }

    escalationLevel = STATUS_ESCALATION.indexOf(status);

    return {
      entity_id: entityId,
      entity_type: 'employee',
      status,
      active_sanctions: activeSanctions,
      total_sanctions: totalSanctions,
      escalation_level: escalationLevel,
    };
  }

  private determineStatus(severity: string, state: EntitySanctionState): SanctionAccountStatus {
    // Direct mapping for explicit severity
    if (severity === 'critical' || severity === 'ban') return 'banned';
    if (severity === 'high' || severity === 'suspend') return 'suspended';
    if (severity === 'medium' || severity === 'restrict') return 'restricted';

    // Progressive escalation based on count
    if (state.total_sanctions >= 3) return nextStatus(state.status);
    return state.status === 'active' ? 'restricted' : state.status;
  }

  private createStatusChangeEvent(
    entityId: string,
    entityType: string,
    previousStatus: SanctionAccountStatus,
    newStatus: SanctionAccountStatus,
    reason: string,
    changedBy: string,
    metadata: GovernanceEventMetadata,
  ) {
    const eventType =
      newStatus === 'banned' ? SANCTION_EVENTS.AccountBanned :
      newStatus === 'suspended' ? SANCTION_EVENTS.AccountSuspended :
      newStatus === 'restricted' ? SANCTION_EVENTS.AccountRestricted :
      SANCTION_EVENTS.AccountReactivated;

    const payload: SanctionStatusChangePayload = {
      entity_id: entityId,
      entity_type: entityType,
      previous_status: previousStatus,
      new_status: newStatus,
      reason,
      changed_by: changedBy,
    };

    return createGovernanceEvent({
      aggregate_type: 'sanction_status',
      aggregate_id: entityId,
      event_type: eventType,
      payload: payload as unknown as Record<string, unknown>,
      metadata,
    });
  }
}

// ── Singleton ──

let _instance: SanctionEngine | null = null;

export function getSanctionEngine(): SanctionEngine {
  if (!_instance) _instance = new SanctionEngine();
  return _instance;
}
