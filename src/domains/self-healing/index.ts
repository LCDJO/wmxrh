/**
 * Self-Healing Platform Layer — Barrel export.
 *
 * SelfHealingEngine
 *  ├── HealthSignalListener      (built into engine via event subscriptions)
 *  ├── IncidentDetector           (pattern matching)
 *  ├── RecoveryOrchestrator       (action coordination + cooldown)
 *  ├── ModuleAutoRecoveryService  (via RecoveryOrchestrator + ModuleOrchestrator)
 *  ├── AccessSafetyGuard          (blocks sensitive perms during critical incidents)
 *  ├── CircuitBreakerManager      (state machines)
 *  ├── HealingAuditLogger         (immutable log)
 *  ├── GovernanceHealingBridge    (GovernanceAI suggestions for high-risk incidents)
 *  ├── SecurityBoundary           (runtime guard — no roles/perms/plans mutation)
 *  ├── AsyncEventQueue            (priority-based async processing)
 *  ├── ActionCooldownManager      (cooldown between automatic actions)
 *  └── FutureCapabilities         (stubs for AI prediction, autoscaling, tenant priority)
 */
export { SelfHealingEngine, getSelfHealingEngine, resetSelfHealingEngine } from './self-healing-engine';
export { IncidentDetector, type DetectionRule } from './incident-detector';
export { RecoveryOrchestrator } from './recovery-orchestrator';
export { ModuleAutoRecoveryService } from './module-auto-recovery-service';
export { CircuitBreakerManager } from './circuit-breaker-manager';
export { AccessSafetyGuard, type SafetyBlockRule } from './access-safety-guard';
export { HealingAuditLogger, type TriggerSource } from './healing-audit-logger';
export { GovernanceHealingBridge, type GovernanceHealingSuggestion } from './governance-healing-bridge';
export { assertAllowedAction, isAllowedAction, SelfHealingSecurityViolation } from './security-boundary';
export { AsyncEventQueue } from './async-event-queue';
export { ActionCooldownManager } from './action-cooldown-manager';
export {
  emitIncidentDetected, emitSelfHealingTriggered,
  emitCircuitOpened, emitCircuitClosed, emitModuleRecovered,
  onSelfHealingEvent, onSelfHealingEventType,
  getSelfHealingEventLog, clearSelfHealingEventLog,
  type SelfHealingDomainEvent, type SelfHealingEventType,
  type IncidentDetectedPayload, type SelfHealingTriggeredPayload,
  type CircuitOpenedPayload, type CircuitClosedPayload, type ModuleRecoveredPayload,
} from './self-healing-events';

// Future capabilities (stubs)
export {
  PredictiveFailureServiceStub, ModuleAutoscalerStub, TenantPriorityServiceStub,
  type PredictiveFailureService, type FailurePrediction,
  type ModuleAutoscaler, type AutoscaleDecision,
  type TenantPriorityService, type TenantPriorityConfig, type TenantTier,
} from './future-capabilities';

export type * from './types';
