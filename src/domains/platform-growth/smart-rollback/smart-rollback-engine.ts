/**
 * SmartRollbackEngine — Autonomous Landing Recovery orchestrator.
 *
 * Platform-level engine that:
 *  1. Monitors conversion metrics after a new version is published
 *  2. Detects significant performance degradation
 *  3. Suggests or auto-executes safe rollback to previous version
 *
 * Architecture:
 *  SmartRollbackEngine
 *   ├── ConversionMonitor          (real-time metric snapshots)
 *   ├── PerformanceComparator      (delta calculation + degradation detection)
 *   ├── RollbackDecisionEngine     (auto vs suggested vs none)
 *   ├── RollbackExecutor           (DB-level version swap)
 *   ├── RollbackAuditService       (immutable audit trail + observability)
 *   └── ExperimentSafetyGuard      (blocks rollback during active A/B tests)
 */
import { conversionMonitor } from './conversion-monitor';
import { performanceComparator } from './performance-comparator';
import { rollbackDecisionEngine } from './rollback-decision-engine';
import { rollbackExecutor } from './rollback-executor';
import { rollbackAuditService } from './rollback-audit-service';
import { experimentSafetyGuard } from './experiment-safety-guard';
import type { RollbackDecision, RollbackExecution, RollbackThresholds } from './types';
import { DEFAULT_ROLLBACK_THRESHOLDS } from './types';

class SmartRollbackEngine {
  private monitoringIntervals = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Start monitoring a landing page after a new version is published.
   * Waits for the observation window, then begins periodic checks.
   */
  startMonitoring(
    landingPageId: string,
    currentVersionId: string,
    currentVersionNumber: number,
    thresholds: RollbackThresholds = DEFAULT_ROLLBACK_THRESHOLDS,
  ): void {
    // Clear any existing monitoring for this page
    this.stopMonitoring(landingPageId);

    // Wait for observation window before starting checks
    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        this.evaluate(landingPageId, currentVersionId, currentVersionNumber, thresholds);
      }, 60_000); // Check every minute

      this.monitoringIntervals.set(landingPageId, interval);
    }, thresholds.observationWindowMs);

    // Store the timeout as an interval (will be replaced by actual interval)
    this.monitoringIntervals.set(landingPageId, startDelay as unknown as ReturnType<typeof setInterval>);

    console.info(
      `[SmartRollbackEngine] Monitoring started for LP ${landingPageId} v${currentVersionNumber}. ` +
      `Observation window: ${thresholds.observationWindowMs / 1000}s`,
    );
  }

  /**
   * Stop monitoring a landing page.
   */
  stopMonitoring(landingPageId: string): void {
    const existing = this.monitoringIntervals.get(landingPageId);
    if (existing) {
      clearInterval(existing);
      this.monitoringIntervals.delete(landingPageId);
    }
  }

  /**
   * Perform a single evaluation cycle for a landing page.
   * Can be called on-demand or by the monitoring loop.
   */
  async evaluate(
    landingPageId: string,
    currentVersionId: string,
    currentVersionNumber: number,
    thresholds: RollbackThresholds = DEFAULT_ROLLBACK_THRESHOLDS,
  ): Promise<RollbackDecision | null> {
    // 1. Capture current metrics
    const currentSnapshot = conversionMonitor.capture(
      landingPageId, currentVersionId, currentVersionNumber,
    );

    // 2. Get previous version baseline
    const previousSnapshot = conversionMonitor.getLastPreviousVersionSnapshot(
      landingPageId, currentVersionId,
    );

    if (!previousSnapshot) {
      // No baseline available — first version, nothing to compare
      return null;
    }

    // 3. Compare performance
    const comparison = performanceComparator.compare(currentSnapshot, previousSnapshot, thresholds);

    if (!comparison.isDegraded) return null;

    // 4. Check experiment safety
    const safety = experimentSafetyGuard.isSafe(landingPageId);
    if (!safety.safe) {
      console.warn(`[SmartRollbackEngine] Rollback blocked: ${safety.reason}`);
      return null;
    }

    // 5. Make decision
    const decision = rollbackDecisionEngine.evaluate(comparison, thresholds);
    if (!decision) return null;

    // 6. Act on decision
    if (decision.mode === 'automatic' && decision.approved) {
      await this.executeRollback(decision, 'system:smart-rollback-engine');
    } else {
      rollbackAuditService.logSuggested(decision);
      console.info(
        `[SmartRollbackEngine] Rollback SUGGESTED for LP ${landingPageId}: ` +
        `v${decision.currentVersionNumber} → v${decision.targetVersionNumber} (${decision.reason})`,
      );
    }

    return decision;
  }

  /**
   * Execute a rollback (automatic or manually approved).
   */
  async executeRollback(
    decision: RollbackDecision,
    executedBy: string,
  ): Promise<RollbackExecution> {
    console.info(
      `[SmartRollbackEngine] Executing rollback: LP ${decision.landingPageId} ` +
      `v${decision.currentVersionNumber} → v${decision.targetVersionNumber}`,
    );

    // Audit: initiated
    const execution = await rollbackExecutor.execute(decision, executedBy);
    await rollbackAuditService.logInitiated(execution, executedBy);

    if (execution.status === 'completed') {
      await rollbackAuditService.logCompleted(execution, executedBy);
      rollbackDecisionEngine.recordExecution(decision.landingPageId);
      this.stopMonitoring(decision.landingPageId);

      console.info(
        `[SmartRollbackEngine] Rollback COMPLETED: LP ${decision.landingPageId} ` +
        `now serving v${decision.targetVersionNumber}`,
      );
    } else {
      await rollbackAuditService.logFailed(execution, executedBy);
    }

    return execution;
  }

  /**
   * Manually trigger a rollback to a specific previous version.
   */
  async manualRollback(
    landingPageId: string,
    currentVersionId: string,
    currentVersionNumber: number,
    targetVersionId: string,
    targetVersionNumber: number,
    executedBy: string,
  ): Promise<RollbackExecution> {
    const currentSnapshot = conversionMonitor.capture(
      landingPageId, currentVersionId, currentVersionNumber,
    );

    const targetSnapshots = conversionMonitor.getByVersion(landingPageId, targetVersionId);
    const targetSnapshot = targetSnapshots[0] ?? {
      ...currentSnapshot,
      versionId: targetVersionId,
      versionNumber: targetVersionNumber,
    };

    const comparison = performanceComparator.compare(currentSnapshot, targetSnapshot);

    const decision: RollbackDecision = {
      id: `rd-manual-${Date.now()}`,
      landingPageId,
      currentVersionId,
      targetVersionId,
      currentVersionNumber,
      targetVersionNumber,
      reason: 'manual_trigger',
      mode: 'manual',
      comparison,
      decidedAt: new Date().toISOString(),
      approved: true,
      approvedBy: executedBy,
    };

    return this.executeRollback(decision, executedBy);
  }

  /**
   * Approve a pending suggested rollback.
   */
  async approveSuggested(decisionId: string, approvedBy: string): Promise<RollbackExecution | null> {
    const decision = rollbackDecisionEngine.approve(decisionId, approvedBy);
    if (!decision) return null;
    return this.executeRollback(decision, approvedBy);
  }

  /**
   * Get all pending rollback suggestions.
   */
  getPendingSuggestions(landingPageId?: string): RollbackDecision[] {
    return rollbackDecisionEngine.getPending(landingPageId);
  }

  /**
   * Get rollback history for a landing page.
   */
  getRollbackHistory(landingPageId: string) {
    return {
      decisions: rollbackDecisionEngine.getHistory(landingPageId),
      executions: rollbackExecutor.getByPage(landingPageId),
      audit: rollbackAuditService.getByPage(landingPageId),
    };
  }

  /**
   * Stop all monitoring.
   */
  shutdown(): void {
    for (const [pageId] of this.monitoringIntervals) {
      this.stopMonitoring(pageId);
    }
  }
}

// Singleton
let _engine: SmartRollbackEngine | null = null;

export function getSmartRollbackEngine(): SmartRollbackEngine {
  if (!_engine) _engine = new SmartRollbackEngine();
  return _engine;
}

export function resetSmartRollbackEngine(): void {
  _engine?.shutdown();
  _engine = null;
}

export { SmartRollbackEngine };
