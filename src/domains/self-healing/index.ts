/**
 * Self-Healing Platform Layer — Barrel export.
 *
 * SelfHealingEngine
 *  ├── HealthSignalListener      (built into engine via event subscriptions)
 *  ├── IncidentDetector           (pattern matching)
 *  ├── RecoveryOrchestrator       (action coordination)
 *  ├── ModuleAutoRecoveryService  (via RecoveryOrchestrator + ModuleOrchestrator)
 *  ├── AccessSafetyGuard          (via CircuitBreakerManager)
 *  ├── CircuitBreakerManager      (state machines)
 *  └── HealingAuditLogger         (immutable log)
 */
export { SelfHealingEngine, getSelfHealingEngine, resetSelfHealingEngine } from './self-healing-engine';
export { IncidentDetector, type DetectionRule } from './incident-detector';
export { RecoveryOrchestrator } from './recovery-orchestrator';
export { ModuleAutoRecoveryService } from './module-auto-recovery-service';
export { CircuitBreakerManager } from './circuit-breaker-manager';
export { HealingAuditLogger } from './healing-audit-logger';
export type * from './types';
