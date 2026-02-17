/**
 * Autonomous Platform Control Plane (APCP) — Barrel export.
 *
 * AutonomousControlPlane
 *  ├── ControlPlaneEngine            (main façade + singleton)
 *  ├── PlatformStateAggregator       (unified state snapshots)
 *  ├── AutomationRuleEngine          (event-driven rule evaluation)
 *  ├── ActionOrchestrator            (safe action execution)
 *  ├── RiskCommandCenter             (aggregated risk view)
 *  ├── ModuleControlCenter           (module ops + circuit state)
 *  ├── IdentityControlCenter         (identity ops summary)
 *  └── ObservabilityBridge           (metrics + health bridge)
 */

export { ControlPlaneEngine, getControlPlaneEngine, resetControlPlaneEngine } from './control-plane-engine';
export { PlatformStateAggregator } from './platform-state-aggregator';
export { AutomationRuleEngine } from './automation-rule-engine';
export { ActionOrchestrator } from './action-orchestrator';
export { RiskCommandCenter } from './risk-command-center';
export { ModuleControlCenter } from './module-control-center';
export { IdentityControlCenter } from './identity-control-center';
export { ObservabilityBridge } from './observability-bridge';
export type * from './types';
