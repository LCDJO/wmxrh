/**
 * Business Continuity & Disaster Recovery Engine — Barrel Export
 *
 * Architecture:
 *   BCDRPlatform
 *    ├── RecoveryPolicyManager   → RTO/RPO per module/tenant
 *    ├── ReplicationController   → data replication health & lag
 *    ├── FailoverOrchestrator    → automatic/manual failover lifecycle
 *    ├── BackupManager           → backup creation, verification, expiry
 *    ├── DRTestRunner            → disaster recovery test lifecycle
 *    ├── ContinuityAuditLogger   → full audit trail for BCDR ops
 *    └── RegionHealthMonitor     → multi-region health monitoring
 *
 * Integrations:
 *    - IncidentManagementEngine → auto-failover on critical incidents
 *    - TenantRollbackEngine     → rollback coordination
 *    - PlatformVersioningEngine → version-aware recovery
 *    - Control Plane            → BCDRCommandCenter widget
 *    - ObservabilityCore        → region health signals
 *    - API Management           → failover-aware routing
 */

export { createBCDREngine, getBCDREngine, resetBCDREngine } from './bcdr-engine';
export { BCDR_KERNEL_EVENTS } from './bcdr-events';

export type {
  BCDRKernelEvent,
  FailoverInitiatedPayload,
  FailoverCompletedPayload,
  ReplicationDegradedPayload,
  RegionHealthChangedPayload,
  DRTestResultPayload,
} from './bcdr-events';

export type {
  RecoveryPriority,
  ReplicationStrategy,
  FailoverMode,
  FailoverTrigger,
  FailoverStatus,
  BackupType,
  BackupStatus,
  DRTestType,
  DRTestStatus,
  RegionStatus,
  ReplicationHealth,
  AuditSeverity,
  RecoveryPolicy,
  ReplicationStatus,
  FailoverRecord,
  BackupRecord,
  DRTestRun,
  BCDRAuditEntry,
  RegionHealth,
  RecoveryPolicyManagerAPI,
  ReplicationControllerAPI,
  FailoverOrchestratorAPI,
  BackupManagerAPI,
  DRTestRunnerAPI,
  ContinuityAuditLoggerAPI,
  RegionHealthMonitorAPI,
  BCDRDashboardStats,
  BCDREngineAPI,
} from './types';
