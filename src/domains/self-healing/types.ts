/**
 * Self-Healing Platform Layer — Type Definitions
 *
 * SelfHealingEngine
 *  ├── HealthSignalListener      (subscribes to health/error events)
 *  ├── IncidentDetector           (pattern matching for anomalies)
 *  ├── RecoveryOrchestrator       (coordinates recovery actions)
 *  ├── ModuleAutoRecoveryService  (module restart/reload)
 *  ├── AccessSafetyGuard          (prevents cascading auth failures)
 *  ├── CircuitBreakerManager      (circuit breaker state machines)
 *  └── HealingAuditLogger         (immutable log of all healing actions)
 */

// ── Health Signals ──────────────────────────────────────────────

export type HealthSignalType =
  | 'module_degraded'
  | 'module_down'
  | 'error_spike'
  | 'latency_spike'
  | 'auth_failure_burst'
  | 'graph_recomp_timeout'
  | 'heartbeat_lost';

export interface HealthSignal {
  id: string;
  type: HealthSignalType;
  source_module: string;
  severity: 'warning' | 'critical';
  detected_at: number;
  metadata: Record<string, unknown>;
}

// ── Incidents ───────────────────────────────────────────────────

export type IncidentStatus = 'detected' | 'recovering' | 'recovered' | 'failed' | 'escalated';
export type IncidentSeverity = 'minor' | 'major' | 'critical';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  signals: HealthSignal[];
  affected_modules: string[];
  recovery_actions: RecoveryAction[];
  detected_at: number;
  resolved_at: number | null;
  auto_recovered: boolean;
  escalated_to?: string;
}

// ── Recovery ────────────────────────────────────────────────────

export type RecoveryActionType =
  | 'module_restart'
  | 'module_deactivate'
  | 'circuit_break'
  | 'cache_clear'
  | 'sandbox_reset'
  | 'access_graph_rebuild'
  | 'rate_limit_engage'
  | 'escalate';

export type RecoveryResult = 'success' | 'partial' | 'failed' | 'skipped';

export interface RecoveryAction {
  id: string;
  type: RecoveryActionType;
  target_module: string;
  description: string;
  executed_at: number;
  duration_ms: number;
  result: RecoveryResult;
  error?: string;
}

// ── Circuit Breaker ─────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerState {
  module_id: string;
  state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_at: number | null;
  last_success_at: number | null;
  opened_at: number | null;
  half_open_at: number | null;
  /** How many consecutive failures to open */
  threshold: number;
  /** How long to wait before half-open (ms) */
  cooldown_ms: number;
}

// ── Audit ───────────────────────────────────────────────────────

export interface HealingAuditEntry {
  id: string;
  incident_id: string;
  action_type: RecoveryActionType;
  target_module: string;
  result: RecoveryResult;
  executed_at: number;
  duration_ms: number;
  metadata: Record<string, unknown>;
}

// ── Engine State ────────────────────────────────────────────────

export interface SelfHealingState {
  enabled: boolean;
  active_incidents: Incident[];
  resolved_incidents: Incident[];
  circuit_breakers: CircuitBreakerState[];
  audit_log: HealingAuditEntry[];
  stats: SelfHealingStats;
}

export interface SelfHealingStats {
  total_incidents: number;
  auto_recovered: number;
  escalated: number;
  failed_recoveries: number;
  avg_recovery_time_ms: number;
  uptime_pct: number;
}
