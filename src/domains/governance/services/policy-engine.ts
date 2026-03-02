/**
 * GovernanceCoreEngine — PolicyEngine
 *
 * Full lifecycle management of governance policies with:
 *   - Mandatory versioning (immutable versions)
 *   - Traceable acceptance (user_id, tenant_id, ip, timestamp)
 *   - requires_reacceptance flag per version
 *   - Immutable legal log (append-only via GovernanceEventStore)
 *
 * Every mutation produces: domain event + LegalEvent + AuditLog
 */

import { GovernanceEventStore } from '../repositories/governance-event-store';
import { GovernanceProjectionStore } from '../repositories/governance-projection-store';
import { createGovernanceEvent, type GovernanceEventMetadata } from '../events/governance-domain-event';
import {
  POLICY_EVENTS,
  type PolicyCreatedPayload,
  type VersionPublishedPayload,
  type AcceptanceRecordedPayload,
  type AcceptanceInvalidatedPayload,
} from '../events/policy-events';
import type { Json } from '@/integrations/supabase/types';

export class PolicyEngine {
  private eventStore = new GovernanceEventStore();
  private projectionStore = new GovernanceProjectionStore();

  // ══════════════════════════════════════
  // POLICY LIFECYCLE
  // ══════════════════════════════════════

  /** Create a new policy (draft). */
  async createPolicy(
    tenantId: string,
    params: {
      slug: string;
      name: string;
      description?: string;
      scope: string;
      category: string;
      requires_acceptance?: boolean;
      grace_period_days?: number;
      created_by: string;
    },
    meta?: Partial<GovernanceEventMetadata>,
  ): Promise<string> {
    const policyId = `pol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const baseMeta: GovernanceEventMetadata = {
      tenant_id: tenantId,
      actor_id: params.created_by,
      actor_type: 'user',
      source_module: 'PolicyEngine',
      ...meta,
    };

    const payload: PolicyCreatedPayload = {
      policy_id: policyId,
      slug: params.slug,
      name: params.name,
      scope: params.scope,
      category: params.category,
      requires_acceptance: params.requires_acceptance ?? true,
      grace_period_days: params.grace_period_days ?? 0,
      created_by: params.created_by,
    };

    await this.eventStore.append([
      createGovernanceEvent({
        aggregate_type: 'policy',
        aggregate_id: policyId,
        event_type: POLICY_EVENTS.PolicyCreated,
        payload: payload as unknown as Record<string, unknown>,
        metadata: baseMeta,
      }),
      this.createAuditEvent(policyId, 'policy_created', { policy_id: policyId, name: params.name }, baseMeta),
    ]);

    // Save projection
    await this.projectionStore.save({
      tenant_id: tenantId,
      projection_name: 'policy_state',
      aggregate_type: 'policy',
      aggregate_id: policyId,
      state: {
        ...payload,
        description: params.description ?? null,
        status: 'draft',
        current_version_id: null,
        current_version_number: 0,
        total_versions: 0,
        created_at: new Date().toISOString(),
      },
      version: 1,
      last_event_id: null,
    });

    return policyId;
  }

  // ══════════════════════════════════════
  // VERSIONING (mandatory, immutable)
  // ══════════════════════════════════════

  /** Publish a new version. Previous versions are never modified. */
  async publishVersion(
    tenantId: string,
    params: {
      policy_id: string;
      title: string;
      content_html: string;
      change_summary?: string;
      requires_reacceptance?: boolean;
      published_by: string;
    },
    meta?: Partial<GovernanceEventMetadata>,
  ): Promise<{ version_id: string; version_number: number }> {
    const baseMeta: GovernanceEventMetadata = {
      tenant_id: tenantId,
      actor_id: params.published_by,
      actor_type: 'user',
      source_module: 'PolicyEngine',
      ...meta,
    };

    // Get current state to determine version number
    const projection = await this.projectionStore.load(tenantId, 'policy_state', 'policy', params.policy_id);
    const currentVersionNumber = ((projection?.state?.current_version_number as number) ?? 0);
    const newVersionNumber = currentVersionNumber + 1;
    const versionId = `pv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const contentHash = await this.hashContent(params.content_html);
    const requiresReacceptance = params.requires_reacceptance ?? false;

    const versionPayload: VersionPublishedPayload = {
      policy_id: params.policy_id,
      version_id: versionId,
      version_number: newVersionNumber,
      title: params.title,
      content_hash: contentHash,
      change_summary: params.change_summary ?? null,
      requires_reacceptance: requiresReacceptance,
      published_by: params.published_by,
    };

    const events = [
      createGovernanceEvent({
        aggregate_type: 'policy',
        aggregate_id: params.policy_id,
        event_type: POLICY_EVENTS.VersionPublished,
        payload: versionPayload as unknown as Record<string, unknown>,
        metadata: baseMeta,
      }),
      // Immutable legal event
      createGovernanceEvent({
        aggregate_type: 'legal_event',
        aggregate_id: params.policy_id,
        event_type: POLICY_EVENTS.LegalEventRecorded,
        payload: {
          action: 'version_published',
          policy_id: params.policy_id,
          version_id: versionId,
          version_number: newVersionNumber,
          content_hash: contentHash,
          requires_reacceptance: requiresReacceptance,
          published_by: params.published_by,
        },
        metadata: baseMeta,
      }),
      this.createAuditEvent(params.policy_id, 'version_published', {
        version_id: versionId,
        version_number: newVersionNumber,
        requires_reacceptance: requiresReacceptance,
      }, baseMeta),
    ];

    // If requires_reacceptance, emit invalidation event
    if (requiresReacceptance) {
      events.push(createGovernanceEvent({
        aggregate_type: 'policy',
        aggregate_id: params.policy_id,
        event_type: POLICY_EVENTS.AcceptanceInvalidated,
        payload: {
          policy_id: params.policy_id,
          version_id: versionId,
          reason: 'Nova versão requer re-aceite',
          invalidated_by: params.published_by,
          affected_tenant_ids: [],
        } satisfies AcceptanceInvalidatedPayload as unknown as Record<string, unknown>,
        metadata: baseMeta,
      }));
    }

    // Save version as its own projection (immutable snapshot)
    await this.projectionStore.save({
      tenant_id: tenantId,
      projection_name: 'policy_version',
      aggregate_type: 'policy_version',
      aggregate_id: versionId,
      state: {
        ...versionPayload,
        content_html: params.content_html,
        published_at: new Date().toISOString(),
        is_current: true,
      },
      version: 1,
      last_event_id: null,
    });

    // Update policy projection
    if (projection) {
      await this.projectionStore.save({
        ...projection,
        state: {
          ...projection.state,
          status: 'active',
          current_version_id: versionId,
          current_version_number: newVersionNumber,
          total_versions: newVersionNumber,
          updated_at: new Date().toISOString(),
        },
        version: projection.version + 1,
        last_event_id: null,
      });
    }

    await this.eventStore.append(events);

    return { version_id: versionId, version_number: newVersionNumber };
  }

  // ══════════════════════════════════════
  // ACCEPTANCE (traceable)
  // ══════════════════════════════════════

  /**
   * Record a policy acceptance with full traceability.
   * Captures: user_id, tenant_id, ip, timestamp, content_hash.
   */
  async recordAcceptance(
    tenantId: string,
    params: {
      policy_id: string;
      version_id: string;
      user_id: string;
      ip_address: string;
      user_agent: string;
    },
    meta?: Partial<GovernanceEventMetadata>,
  ): Promise<string> {
    const acceptanceId = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const baseMeta: GovernanceEventMetadata = {
      tenant_id: tenantId,
      actor_id: params.user_id,
      actor_type: 'user',
      source_module: 'PolicyEngine',
      ip_address: params.ip_address,
      user_agent: params.user_agent,
      ...meta,
    };

    // Load version to get content_hash and version_number
    const versionProjection = await this.projectionStore.load(
      tenantId, 'policy_version', 'policy_version', params.version_id,
    );
    const contentHash = (versionProjection?.state?.content_hash as string) ?? '';
    const versionNumber = (versionProjection?.state?.version_number as number) ?? 0;

    const acceptancePayload: AcceptanceRecordedPayload = {
      policy_id: params.policy_id,
      version_id: params.version_id,
      version_number: versionNumber,
      user_id: params.user_id,
      tenant_id: tenantId,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
      accepted_at: new Date().toISOString(),
      content_hash: contentHash,
    };

    await this.eventStore.append([
      // Acceptance event
      createGovernanceEvent({
        aggregate_type: 'policy_acceptance',
        aggregate_id: acceptanceId,
        event_type: POLICY_EVENTS.AcceptanceRecorded,
        payload: acceptancePayload as unknown as Record<string, unknown>,
        metadata: baseMeta,
      }),
      // Immutable legal event
      createGovernanceEvent({
        aggregate_type: 'legal_event',
        aggregate_id: params.user_id,
        event_type: POLICY_EVENTS.LegalEventRecorded,
        payload: {
          action: 'policy_accepted',
          acceptance_id: acceptanceId,
          policy_id: params.policy_id,
          version_id: params.version_id,
          version_number: versionNumber,
          content_hash: contentHash,
          user_id: params.user_id,
          tenant_id: tenantId,
          ip_address: params.ip_address,
          user_agent: params.user_agent,
        },
        metadata: baseMeta,
      }),
      // Audit log
      this.createAuditEvent(params.policy_id, 'acceptance_recorded', {
        acceptance_id: acceptanceId,
        user_id: params.user_id,
        version_id: params.version_id,
        ip_address: params.ip_address,
      }, baseMeta),
    ]);

    // Save acceptance projection
    await this.projectionStore.save({
      tenant_id: tenantId,
      projection_name: 'policy_acceptance',
      aggregate_type: 'policy_acceptance',
      aggregate_id: `${params.user_id}:${params.policy_id}`,
      state: {
        ...acceptancePayload,
        acceptance_id: acceptanceId,
        is_valid: true,
      },
      version: (versionNumber),
      last_event_id: null,
    });

    return acceptanceId;
  }

  // ══════════════════════════════════════
  // QUERIES
  // ══════════════════════════════════════

  /** Get policy state (from projection). */
  async getPolicy(tenantId: string, policyId: string) {
    return this.projectionStore.load(tenantId, 'policy_state', 'policy', policyId);
  }

  /** Get version details. */
  async getVersion(tenantId: string, versionId: string) {
    return this.projectionStore.load(tenantId, 'policy_version', 'policy_version', versionId);
  }

  /** Get acceptance state for a user+policy pair. */
  async getAcceptance(tenantId: string, userId: string, policyId: string) {
    return this.projectionStore.load(tenantId, 'policy_acceptance', 'policy_acceptance', `${userId}:${policyId}`);
  }

  /** Check if user has accepted the current version of a policy. */
  async hasAcceptedCurrentVersion(tenantId: string, userId: string, policyId: string): Promise<boolean> {
    const policy = await this.getPolicy(tenantId, policyId);
    if (!policy) return false;

    const acceptance = await this.getAcceptance(tenantId, userId, policyId);
    if (!acceptance) return false;

    const isValid = acceptance.state.is_valid as boolean;
    const acceptedVersion = acceptance.state.version_id as string;
    const currentVersion = policy.state.current_version_id as string;

    return isValid && acceptedVersion === currentVersion;
  }

  /** Get pending policies for a user (not yet accepted current version). */
  async getPendingPolicies(tenantId: string, userId: string): Promise<Array<{ policy_id: string; name: string; version_id: string }>> {
    const allPolicies = await this.projectionStore.listByProjection(tenantId, 'policy_state', { limit: 100 });
    const pending: Array<{ policy_id: string; name: string; version_id: string }> = [];

    for (const p of allPolicies) {
      if (p.state.status !== 'active') continue;
      if (!(p.state.requires_acceptance as boolean)) continue;

      const accepted = await this.hasAcceptedCurrentVersion(tenantId, userId, p.aggregate_id);
      if (!accepted) {
        pending.push({
          policy_id: p.aggregate_id,
          name: p.state.name as string,
          version_id: p.state.current_version_id as string,
        });
      }
    }

    return pending;
  }

  /** Full event history for a policy. */
  async getPolicyEventStream(tenantId: string, policyId: string) {
    return this.eventStore.loadStream(tenantId, 'policy', policyId);
  }

  /** All legal events for a policy. */
  async getLegalEvents(tenantId: string, policyId: string) {
    return this.eventStore.loadStream(tenantId, 'legal_event', policyId);
  }

  /** Acceptance audit trail for a user. */
  async getUserAcceptanceHistory(tenantId: string, userId: string) {
    return this.eventStore.queryByType(tenantId, POLICY_EVENTS.AcceptanceRecorded, { limit: 200 })
      .then(events => events.filter(e => (e.payload as Record<string, unknown>).user_id === userId));
  }

  // ══════════════════════════════════════
  // INTERNAL
  // ══════════════════════════════════════

  private createAuditEvent(
    aggregateId: string,
    action: string,
    details: Record<string, unknown>,
    metadata: GovernanceEventMetadata,
  ) {
    return createGovernanceEvent({
      aggregate_type: 'audit_log',
      aggregate_id: aggregateId,
      event_type: POLICY_EVENTS.AuditLogRecorded,
      payload: { action, ...details, timestamp: new Date().toISOString() },
      metadata,
    });
  }

  private async hashContent(content: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback for environments without crypto.subtle
      return `hash_${Date.now()}_${content.length}`;
    }
  }
}

// ── Singleton ──

let _instance: PolicyEngine | null = null;

export function getPolicyEngine(): PolicyEngine {
  if (!_instance) _instance = new PolicyEngine();
  return _instance;
}
