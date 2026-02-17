/**
 * RollbackAuditService — Immutable audit trail for all rollback operations.
 *
 * Integrates with LandingAuditLog for platform-level persistence
 * and emits growth domain events for cross-domain observability.
 */
import { landingAuditLog } from '../landing-audit-log';
import { emitGrowthEvent } from '../growth.events';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import { recordRollbackTriggered, recordPerformanceDropScore, updateRollbackSuccessRate } from '@/domains/observability/growth-metrics-collector';
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

    // Prometheus-compatible rollback metrics
    recordRollbackTriggered(execution.landingPageId, execution.mode as 'automatic' | 'manual');
    recordPerformanceDropScore(execution.landingPageId, 0);

    // Domain event: RollbackAuditLogged
    emitGrowthEvent({
      type: 'RollbackAuditLogged',
      timestamp: Date.now(),
      landingPageId: execution.landingPageId,
      action: 'rollback_initiated',
      fromVersion: execution.fromVersionNumber,
      toVersion: execution.toVersionNumber,
      actorId,
      auditEntryId: entry.id,
    });
  }

  /**
   * Log a successful rollback completion.
   */
  async logCompleted(execution: RollbackExecution, actorId: string): Promise<void> {
    const entry = this.createEntry(execution, 'rollback_completed', actorId);
    this.entries.push(entry);

    // Emit RollbackExecuted event
    emitGrowthEvent({
      type: 'RollbackExecuted',
      timestamp: Date.now(),
      landingPageId: execution.landingPageId,
      fromVersion: execution.fromVersionNumber,
      toVersion: execution.toVersionNumber,
      mode: execution.mode as 'automatic' | 'manual',
      reason: execution.reason,
      executedBy: actorId,
      executionId: execution.id,
    });

    // Also emit legacy LandingPagePublished for cross-domain compat
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

    // Update success rate
    const all = this.entries;
    const triggered = all.filter(e => e.action === 'rollback_initiated').length;
    const completed = all.filter(e => e.action === 'rollback_completed').length;
    updateRollbackSuccessRate(completed, triggered);

    // Domain event: RollbackAuditLogged
    emitGrowthEvent({
      type: 'RollbackAuditLogged',
      timestamp: Date.now(),
      landingPageId: execution.landingPageId,
      action: 'rollback_completed',
      fromVersion: execution.fromVersionNumber,
      toVersion: execution.toVersionNumber,
      actorId,
      auditEntryId: entry.id,
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

    // Domain event: RollbackSuggested
    emitGrowthEvent({
      type: 'RollbackSuggested',
      timestamp: Date.now(),
      landingPageId: decision.landingPageId,
      currentVersion: decision.currentVersionNumber,
      targetVersion: decision.targetVersionNumber,
      reason: decision.reason,
      conversionDelta: decision.comparison.conversionRateDelta,
      confidence: decision.comparison.confidence,
      decisionId: decision.id,
    });
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
