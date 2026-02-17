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

export { SmartRollbackEngine, getSmartRollbackEngine, resetSmartRollbackEngine, AUTO_ROLLBACK_AUTHORIZED_ROLES } from './smart-rollback-engine';
export { ConversionMonitor, conversionMonitor } from './conversion-monitor';
export { PerformanceComparator, performanceComparator, DEFAULT_ROLLBACK_POLICY } from './performance-comparator';
export type { RollbackPolicy, PerformanceAlert, PerformanceAlertTrigger, PerformanceAlertSeverity } from './performance-comparator';
export { RollbackDecisionEngine, rollbackDecisionEngine } from './rollback-decision-engine';
export { RollbackExecutor, rollbackExecutor } from './rollback-executor';
export { RollbackAuditService, rollbackAuditService } from './rollback-audit-service';
export { ExperimentSafetyGuard, experimentSafetyGuard } from './experiment-safety-guard';
export type { SafetyCheckResult, OverrideApproval } from './experiment-safety-guard';
export { GovernanceAIVersionAnalyzer, governanceVersionAnalyzer } from './governance-version-analyzer';
export type { GovernanceVersionReport, GovernanceVersionIssue, GovernanceRiskLevel, GovernanceIssueType } from './governance-version-analyzer';
export { DEFAULT_ROLLBACK_THRESHOLDS } from './types';
export type * from './types';
