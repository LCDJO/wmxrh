/**
 * Chaos Engineering Engine — Barrel Export
 *
 * Architecture:
 *   ChaosEngineeringPlatform
 *    ├── FaultInjectionController  → inject/stop simulated faults
 *    ├── ChaosScenarioManager      → scenario templates (CRUD)
 *    ├── ImpactAnalyzer             → measure blast radius & impact
 *    ├── SLAValidator               → validate SLA compliance
 *    ├── RTOValidator               → validate RTO/RPO compliance
 *    ├── ChaosReportGenerator       → findings & recommendations
 *    └── SafetyGuard                → pre-checks & emergency stop
 *
 * Integrations:
 *    - BCDREngine             → failover validation, RTO/RPO
 *    - IncidentManagement     → auto-create incidents on breaches
 *    - SelfHealingEngine      → validate auto-recovery
 *    - ObservabilityCore      → metrics collection
 *    - Control Plane          → dashboard widget
 *    - TenantRollbackEngine   → rollback coordination
 */

export { createChaosEngine, getChaosEngine, resetChaosEngine } from './chaos-engine';
export { CHAOS_KERNEL_EVENTS } from './chaos-events';
export { collectChaosMetrics } from './chaos-metrics-collector';

export type {
  ChaosKernelEvent,
  ChaosExperimentPayload,
  ChaosSafetyStopPayload,
  ChaosValidationPayload,
} from './chaos-events';

export type {
  FaultType,
  BlastRadius,
  ExperimentStatus,
  ChaosSeverity,
  ChaosScenario,
  ChaosExperiment,
  ChaosAuditEntry,
  FaultInjectionParams,
  ActiveFault,
  FaultInjectionControllerAPI,
  ChaosScenarioManagerAPI,
  ImpactAnalysisResult,
  ImpactAnalyzerAPI,
  SLAValidationResult,
  SLAValidatorAPI,
  RTOValidationResult,
  RTOValidatorAPI,
  ChaosReportFinding,
  ChaosReportRecommendation,
  ChaosReport,
  ChaosReportGeneratorAPI,
  SafetyGuardAPI,
  ChaosEngineDashboardStats,
  ChaosEngineeringAPI,
} from './types';
