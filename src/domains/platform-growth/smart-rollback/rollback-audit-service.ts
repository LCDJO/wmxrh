/**
 * RollbackAuditService — Immutable audit trail for all rollback operations.
 *
 * Integrates with LandingAuditLog for platform-level persistence
 * and emits growth domain events for cross-domain observability.
 */
import { landingAuditLog } from '../landing-audit-log';
import { emitGrowthEvent } from '../growth.events';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import type { RollbackAuditEntry, RollbackDecision, RollbackExecution } from './types';

class RollbackAuditService {
  private entries: RollbackAuditEntry[] = [];

  /**
   * Log a rollback initiation (automatic or manual).
   */
  async logInitiated(execution: RollbackExecution, actorId: string): Promise<void> {
    const entry = this.createEntry(execution, 'rollback_initiated', actorId);
    this.entries.push(entry);

    // Persist via landing audit log
    await landingAuditLog.record({
      action_type: 'version_superseded',
      landing_page_id: execution.landingPageId,
      version_id: execution.fromVersionId,
      version_number: execution.fromVersionNumber,
      actor_id: actorId,
      actor_email: 'system@platform',
      actor_role: execution.mode === 'automatic' ? 'SmartRollbackEngine' : 'PlatformOperator',
      metadata: {
        rollback_execution_id: execution.id,
        rollback_reason: execution.reason,
        rollback_mode: execution.mode,
        target_version: execution.toVersionNumber,
      },
    });

    // Metrics
    const mc = getMetricsCollector();
    mc.increment('landing_rollback_initiated_total', {
      landing_page_id: execution.landingPageId,
      mode: execution.mode,
      reason: execution.reason,
    });
  }

  /**
   * Log a successful rollback completion.
   */
  async logCompleted(execution: RollbackExecution, actorId: string): Promise<void> {
    const entry = this.createEntry(execution, 'rollback_completed', actorId);
    this.entries.push(entry);

    // Emit growth event
    emitGrowthEvent({
      type: 'LandingPagePublished',
      timestamp: Date.now(),
      pageId: execution.landingPageId,
      pageName: '',
      slug: '',
      publishedBy: actorId,
      publisherRole: 'SmartRollbackEngine',
    });

    // Metrics
    const mc = getMetricsCollector();
    mc.increment('landing_rollback_completed_total', {
      landing_page_id: execution.landingPageId,
      reason: execution.reason,
    });
  }

  /**
   * Log a failed rollback.
   */
  async logFailed(execution: RollbackExecution, actorId: string): Promise<void> {
    const entry = this.createEntry(execution, 'rollback_failed', actorId, {
      error: execution.error,
    });
    this.entries.push(entry);

    const mc = getMetricsCollector();
    mc.increment('landing_rollback_failed_total', {
      landing_page_id: execution.landingPageId,
      reason: execution.reason,
    });
  }

  /**
   * Log a suggestion (not yet executed).
   */
  logSuggested(decision: RollbackDecision): void {
    const entry: RollbackAuditEntry = {
      id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      executionId: '',
      landingPageId: decision.landingPageId,
      action: 'rollback_suggested',
      fromVersion: decision.currentVersionNumber,
      toVersion: decision.targetVersionNumber,
      reason: decision.reason,
      mode: decision.mode,
      actorId: 'system',
      metadata: {
        decision_id: decision.id,
        confidence: decision.comparison.confidence,
        conversion_rate_delta: decision.comparison.conversionRateDelta,
        revenue_delta: decision.comparison.revenueDelta,
      },
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
  }

  /**
   * Get audit trail for a landing page.
   */
  getByPage(landingPageId: string): RollbackAuditEntry[] {
    return this.entries.filter(e => e.landingPageId === landingPageId);
  }

  /**
   * Get full audit trail.
   */
  getAll(): RollbackAuditEntry[] {
    return [...this.entries];
  }

  private createEntry(
    execution: RollbackExecution,
    action: RollbackAuditEntry['action'],
    actorId: string,
    extraMeta: Record<string, unknown> = {},
  ): RollbackAuditEntry {
    return {
      id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      executionId: execution.id,
      landingPageId: execution.landingPageId,
      action,
      fromVersion: execution.fromVersionNumber,
      toVersion: execution.toVersionNumber,
      reason: execution.reason,
      mode: execution.mode,
      actorId,
      metadata: {
        decision_id: execution.decisionId,
        ...extraMeta,
      },
      createdAt: new Date().toISOString(),
    };
  }
}

export const rollbackAuditService = new RollbackAuditService();
export { RollbackAuditService };
