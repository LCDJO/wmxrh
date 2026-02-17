/**
 * Smart Rollback Engine — Barrel export.
 *
 * SmartRollbackEngine
 *  ├── ConversionMonitor          (real-time metric snapshots)
 *  ├── PerformanceComparator      (delta calculation + degradation detection)
 *  ├── RollbackDecisionEngine     (auto vs suggested vs none)
 *  ├── RollbackExecutor           (DB-level version swap)
 *  ├── RollbackAuditService       (immutable audit trail + observability)
 *  └── ExperimentSafetyGuard      (blocks rollback during active A/B tests)
 */

export { SmartRollbackEngine, getSmartRollbackEngine, resetSmartRollbackEngine } from './smart-rollback-engine';
export { ConversionMonitor, conversionMonitor } from './conversion-monitor';
export { PerformanceComparator, performanceComparator } from './performance-comparator';
export { RollbackDecisionEngine, rollbackDecisionEngine } from './rollback-decision-engine';
export { RollbackExecutor, rollbackExecutor } from './rollback-executor';
export { RollbackAuditService, rollbackAuditService } from './rollback-audit-service';
export { ExperimentSafetyGuard, experimentSafetyGuard } from './experiment-safety-guard';
export { DEFAULT_ROLLBACK_THRESHOLDS } from './types';
export type * from './types';
