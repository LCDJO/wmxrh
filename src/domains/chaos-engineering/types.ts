/**
 * Chaos Engineering Engine — Types
 */

// ── Enums ────────────────────────────────────────────

export type FaultType =
  | 'latency_injection'
  | 'service_shutdown'
  | 'cpu_stress'
  | 'memory_stress'
  | 'disk_stress'
  | 'network_partition'
  | 'dns_failure'
  | 'dependency_failure'
  | 'data_corruption'
  | 'region_failure'
  | 'cascading_failure';

export type BlastRadius = 'single_service' | 'service_group' | 'availability_zone' | 'region' | 'global';

export type ExperimentStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'aborted' | 'safety_stopped';

export type ChaosSeverity = 'info' | 'warning' | 'critical';

// ── Entities ─────────────────────────────────────────

export interface ChaosScenario {
  id: string;
  name: string;
  description: string | null;
  fault_type: FaultType;
  target_module: string | null;
  target_region: string | null;
  parameters: Record<string, any>;
  safety_constraints: Record<string, any>;
  blast_radius: BlastRadius;
  max_duration_minutes: number;
  requires_approval: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChaosExperiment {
  id: string;
  scenario_id: string | null;
  name: string;
  status: ExperimentStatus;
  fault_type: FaultType;
  target_module: string | null;
  target_region: string | null;
  parameters: Record<string, any>;
  blast_radius: BlastRadius;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  aborted_at: string | null;
  abort_reason: string | null;
  max_duration_minutes: number;
  safety_stopped: boolean;
  safety_stop_reason: string | null;
  initiated_by: string | null;
  approved_by: string | null;
  sla_target_pct: number | null;
  sla_actual_pct: number | null;
  sla_met: boolean | null;
  rto_target_minutes: number | null;
  rto_actual_minutes: number | null;
  rto_met: boolean | null;
  rpo_target_minutes: number | null;
  rpo_actual_minutes: number | null;
  rpo_met: boolean | null;
  affected_services: string[];
  affected_tenants: string[];
  error_rate_before: number | null;
  error_rate_during: number | null;
  latency_before_ms: number | null;
  latency_during_ms: number | null;
  incident_id: string | null;
  failover_id: string | null;
  self_healing_triggered: boolean;
  escalation_triggered: boolean;
  findings: any[];
  recommendations: any[];
  impact_score: number | null;
  resilience_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChaosAuditEntry {
  id: string;
  experiment_id: string | null;
  event_type: string;
  details: Record<string, any>;
  severity: ChaosSeverity;
  actor_id: string | null;
  created_at: string;
}

// ── API Interfaces ───────────────────────────────────

export interface FaultInjectionControllerAPI {
  injectFault(experiment: ChaosExperiment): Promise<void>;
  stopFault(experimentId: string): Promise<void>;
}

export interface ChaosScenarioManagerAPI {
  list(): Promise<ChaosScenario[]>;
  create(scenario: Partial<ChaosScenario> & { name: string; fault_type: FaultType }): Promise<ChaosScenario>;
  update(id: string, updates: Partial<ChaosScenario>): Promise<void>;
  deactivate(id: string): Promise<void>;
}

export interface ImpactAnalyzerAPI {
  analyze(experimentId: string): Promise<{
    impact_score: number;
    resilience_score: number;
    affected_services: string[];
    error_rate_delta: number;
    latency_delta_ms: number;
  }>;
}

export interface SLAValidatorAPI {
  validate(experimentId: string): Promise<{ sla_met: boolean; actual_pct: number; target_pct: number }>;
}

export interface RTOValidatorAPI {
  validate(experimentId: string): Promise<{ rto_met: boolean; actual_minutes: number; target_minutes: number; rpo_met: boolean; rpo_actual: number; rpo_target: number }>;
}

export interface ChaosReportGeneratorAPI {
  generate(experimentId: string): Promise<{ findings: any[]; recommendations: any[]; summary: string }>;
}

export interface SafetyGuardAPI {
  check(experiment: Partial<ChaosExperiment>): Promise<{ safe: boolean; reasons: string[] }>;
  emergencyStop(experimentId: string, reason: string): Promise<void>;
}

export interface ChaosEngineDashboardStats {
  total_experiments: number;
  running: number;
  completed: number;
  failed: number;
  safety_stopped: number;
  avg_resilience_score: number;
  avg_impact_score: number;
  sla_compliance_pct: number;
  rto_compliance_pct: number;
}

export interface ChaosEngineeringAPI {
  scenarios: ChaosScenarioManagerAPI;
  faultInjection: FaultInjectionControllerAPI;
  impact: ImpactAnalyzerAPI;
  sla: SLAValidatorAPI;
  rto: RTOValidatorAPI;
  reports: ChaosReportGeneratorAPI;
  safety: SafetyGuardAPI;
  runExperiment(scenarioId: string, overrides?: Partial<ChaosExperiment>): Promise<ChaosExperiment>;
  abortExperiment(experimentId: string, reason: string): Promise<void>;
  getExperiments(limit?: number): Promise<ChaosExperiment[]>;
  getDashboardStats(): Promise<ChaosEngineDashboardStats>;
}
