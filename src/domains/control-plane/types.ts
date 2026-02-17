/**
 * Autonomous Platform Control Plane (APCP) — Type Definitions
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY CONTRACT                                              ║
 * ║  The APCP orchestrates existing subsystems. It does NOT bypass   ║
 * ║  the Security Kernel. All authorization flows through POSL.      ║
 * ║  The APCP provides a unified OPERATIONAL surface, not auth.      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ══════════════════════════════════════════════════════════════════
// Platform State
// ══════════════════════════════════════════════════════════════════

export type PlatformHealthLevel = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface PlatformStateSnapshot {
  timestamp: number;
  health: PlatformHealthLevel;
  runtime_phase: string;
  uptime_ms: number;

  // ── ModuleOrchestrator ──────────────────────────────────────
  total_services: number;
  total_modules: number;
  active_modules: number;
  error_modules: number;
  suspended_modules: number;
  total_features: number;
  active_features: number;
  module_dependency_depth: number;

  // ── ObservabilityCore ───────────────────────────────────────
  observability: {
    total_errors_last_hour: number;
    healthy_modules: number;
    degraded_modules: number;
    down_modules: number;
    avg_latency_ms: number;
    error_rate_pct: number;
    metrics_collected: number;
  };

  // ── SelfHealingEngine ───────────────────────────────────────
  self_healing: {
    enabled: boolean;
    active_incidents: number;
    resolved_incidents_total: number;
    open_circuit_breakers: number;
    auto_recovered_total: number;
    escalated_total: number;
    avg_recovery_time_ms: number;
    uptime_pct: number;
  };

  // ── GovernanceAI ────────────────────────────────────────────
  governance: {
    total_insights: number;
    critical_insights: number;
    warning_insights: number;
    sod_conflicts: number;
    excessive_permissions: number;
    role_overlaps: number;
    last_scan_at: number | null;
    ai_analysis_available: boolean;
  };

  // ── UnifiedGraphEngine (UGE) ────────────────────────────────
  unified_graph: {
    total_nodes: number;
    total_edges: number;
    registered_domains: string[];
    graph_version: number;
    built_at: number | null;
    risk_signals_count: number;
    high_risk_users: number;
  };

  // ── Identity ────────────────────────────────────────────────
  active_sessions_estimate: number;
  active_impersonations: number;

  // ── Aggregated Risk ─────────────────────────────────────────
  overall_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';

  // ── Sub-system health ───────────────────────────────────────
  subsystem_health: SubsystemHealth[];
}

export interface SubsystemHealth {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message?: string;
  last_check: number;
}

// ══════════════════════════════════════════════════════════════════
// Automation Rules
// ══════════════════════════════════════════════════════════════════

export type AutomationTriggerType =
  | 'incident_detected'
  | 'circuit_opened'
  | 'module_error'
  | 'risk_threshold'
  | 'health_degraded'
  | 'error_spike'
  | 'latency_threshold'
  | 'manual';

export type AutomationActionType =
  | 'restart_module'
  | 'deactivate_module'
  | 'notify'
  | 'escalate'
  | 'enable_feature'
  | 'disable_feature'
  | 'log_audit'
  | 'custom_webhook';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  actions: AutomationAction[];
  cooldown_ms: number;
  last_triggered_at: number | null;
  trigger_count: number;
  created_at: number;
}

export interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
}

export interface AutomationExecutionResult {
  rule_id: string;
  triggered_at: number;
  actions_executed: Array<{
    type: AutomationActionType;
    success: boolean;
    message?: string;
  }>;
  overall_success: boolean;
}

// ══════════════════════════════════════════════════════════════════
// Action Orchestrator
// ══════════════════════════════════════════════════════════════════

export type ControlAction =
  | { type: 'restart_module'; module_key: string }
  | { type: 'deactivate_module'; module_key: string }
  | { type: 'activate_module'; module_key: string }
  | { type: 'toggle_feature'; feature_key: string; enabled: boolean }
  | { type: 'clear_circuit_breaker'; module_key: string }
  | { type: 'flush_caches' }
  | { type: 'force_health_check' };

export interface ActionResult {
  action: ControlAction;
  success: boolean;
  message: string;
  executed_at: number;
}

// ══════════════════════════════════════════════════════════════════
// Risk Command Center
// ══════════════════════════════════════════════════════════════════

export interface RiskSummary {
  overall_score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  top_risks: RiskItem[];
  trend: 'improving' | 'stable' | 'worsening';
  last_assessed_at: number;
}

export interface RiskItem {
  id: string;
  category: 'identity' | 'access' | 'module' | 'compliance' | 'infrastructure';
  title: string;
  score: number;
  description: string;
  suggested_action?: string;
}

// ══════════════════════════════════════════════════════════════════
// Module Control
// ══════════════════════════════════════════════════════════════════

export interface ModuleControlInfo {
  key: string;
  label: string;
  status: string;
  version: string;
  is_core: boolean;
  circuit_breaker_state: 'closed' | 'open' | 'half_open' | 'none';
  dependencies: string[];
  dependents: string[];
  error_count_last_hour: number;
  last_activated_at: number | null;
}

// ══════════════════════════════════════════════════════════════════
// Identity Control
// ══════════════════════════════════════════════════════════════════

export interface IdentityControlSummary {
  total_active_users_estimate: number;
  active_impersonations: number;
  high_risk_users: number;
  recent_identity_events: IdentityEvent[];
}

export interface IdentityEvent {
  type: string;
  user_id: string;
  timestamp: number;
  details?: string;
}

// ══════════════════════════════════════════════════════════════════
// APCP API
// ══════════════════════════════════════════════════════════════════

export interface ControlPlaneAPI {
  // State aggregation
  getState(): PlatformStateSnapshot;
  getStateHistory(limit?: number): PlatformStateSnapshot[];

  // Automation
  listRules(): AutomationRule[];
  addRule(rule: Omit<AutomationRule, 'id' | 'last_triggered_at' | 'trigger_count' | 'created_at'>): string;
  removeRule(ruleId: string): void;
  toggleRule(ruleId: string, enabled: boolean): void;

  // Actions
  execute(action: ControlAction): ActionResult;

  // Risk
  getRiskSummary(): RiskSummary;

  // Module control
  getModuleControl(): ModuleControlInfo[];

  // Identity control
  getIdentityControl(): IdentityControlSummary;

  // Lifecycle
  start(): void;
  stop(): void;
}
