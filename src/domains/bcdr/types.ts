/**
 * Business Continuity & Disaster Recovery Engine — Types
 */

// ── Enums ────────────────────────────────────────────

export type RecoveryPriority = 'critical' | 'high' | 'medium' | 'low';
export type ReplicationStrategy = 'sync' | 'async' | 'snapshot';
export type FailoverMode = 'automatic' | 'manual' | 'semi-automatic';
export type FailoverTrigger = 'automatic' | 'manual' | 'dr_test';
export type FailoverStatus = 'initiated' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
export type BackupType = 'full' | 'incremental' | 'differential' | 'snapshot';
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
export type DRTestType = 'tabletop' | 'simulation' | 'partial_failover' | 'full_failover';
export type DRTestStatus = 'scheduled' | 'running' | 'passed' | 'failed' | 'cancelled';
export type RegionStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';
export type ReplicationHealth = 'healthy' | 'degraded' | 'failed' | 'initializing';
export type AuditSeverity = 'info' | 'warning' | 'critical';

// ── Entities ─────────────────────────────────────────

export interface RecoveryPolicy {
  id: string;
  tenant_id: string | null;
  module_name: string;
  rto_minutes: number;
  rpo_minutes: number;
  priority: RecoveryPriority;
  replication_strategy: ReplicationStrategy;
  failover_mode: FailoverMode;
  backup_frequency_minutes: number;
  retention_days: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReplicationStatus {
  id: string;
  policy_id: string | null;
  source_region: string;
  target_region: string;
  lag_seconds: number;
  last_synced_at: string | null;
  status: ReplicationHealth;
  bytes_replicated: number;
  created_at: string;
  updated_at: string;
}

export interface FailoverRecord {
  id: string;
  policy_id: string | null;
  trigger_type: FailoverTrigger;
  trigger_reason: string | null;
  source_region: string;
  target_region: string;
  status: FailoverStatus;
  started_at: string;
  completed_at: string | null;
  rto_actual_minutes: number | null;
  rpo_actual_minutes: number | null;
  rto_met: boolean | null;
  rpo_met: boolean | null;
  affected_tenants: string[];
  incident_id: string | null;
  initiated_by: string | null;
  error_details: string | null;
  created_at: string;
}

export interface BackupRecord {
  id: string;
  policy_id: string | null;
  backup_type: BackupType;
  status: BackupStatus;
  size_bytes: number;
  storage_location: string | null;
  started_at: string;
  completed_at: string | null;
  expires_at: string | null;
  checksum: string | null;
  verified: boolean;
  verified_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface DRTestRun {
  id: string;
  test_name: string;
  test_type: DRTestType;
  scenario_description: string | null;
  status: DRTestStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  rto_target_minutes: number | null;
  rto_actual_minutes: number | null;
  rpo_target_minutes: number | null;
  rpo_actual_minutes: number | null;
  rto_met: boolean | null;
  rpo_met: boolean | null;
  modules_tested: string[];
  findings: any[];
  recommendations: any[];
  executed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BCDRAuditEntry {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  details: Record<string, any>;
  severity: AuditSeverity;
  created_at: string;
}

export interface RegionHealth {
  id: string;
  region_name: string;
  status: RegionStatus;
  latency_ms: number;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  disk_usage_pct: number;
  active_connections: number;
  last_health_check_at: string;
  is_primary: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ── API Interfaces ───────────────────────────────────

export interface RecoveryPolicyManagerAPI {
  list(): Promise<RecoveryPolicy[]>;
  getByModule(module: string): Promise<RecoveryPolicy | null>;
  upsert(policy: Partial<RecoveryPolicy> & { module_name: string }): Promise<RecoveryPolicy>;
  deactivate(policyId: string): Promise<void>;
}

export interface ReplicationControllerAPI {
  getStatus(): Promise<ReplicationStatus[]>;
  getByPolicy(policyId: string): Promise<ReplicationStatus | null>;
  updateLag(id: string, lagSeconds: number): Promise<void>;
  checkHealth(): Promise<{ healthy: number; degraded: number; failed: number }>;
}

export interface FailoverOrchestratorAPI {
  initiate(policyId: string, reason: string, trigger: FailoverTrigger, initiatedBy?: string): Promise<FailoverRecord>;
  complete(failoverId: string, rtoActual: number, rpoActual: number): Promise<FailoverRecord>;
  fail(failoverId: string, error: string): Promise<void>;
  rollback(failoverId: string): Promise<void>;
  getActive(): Promise<FailoverRecord[]>;
  getHistory(limit?: number): Promise<FailoverRecord[]>;
}

export interface BackupManagerAPI {
  create(policyId: string, type: BackupType): Promise<BackupRecord>;
  complete(backupId: string, sizeBytes: number, checksum: string): Promise<void>;
  verify(backupId: string): Promise<boolean>;
  getLatest(policyId: string): Promise<BackupRecord | null>;
  listByStatus(status: BackupStatus): Promise<BackupRecord[]>;
  expireOld(): Promise<number>;
}

export interface DRTestRunnerAPI {
  schedule(test: Pick<DRTestRun, 'test_name' | 'test_type' | 'scenario_description' | 'modules_tested' | 'rto_target_minutes' | 'rpo_target_minutes'>): Promise<DRTestRun>;
  start(testId: string): Promise<void>;
  complete(testId: string, findings: any[], recommendations: any[], rtoActual: number, rpoActual: number): Promise<DRTestRun>;
  cancel(testId: string): Promise<void>;
  getHistory(limit?: number): Promise<DRTestRun[]>;
}

export interface ContinuityAuditLoggerAPI {
  log(entry: Omit<BCDRAuditEntry, 'id' | 'created_at'>): Promise<void>;
  query(filter?: { event_type?: string; severity?: AuditSeverity; limit?: number }): Promise<BCDRAuditEntry[]>;
}

export interface RegionHealthMonitorAPI {
  getAll(): Promise<RegionHealth[]>;
  getPrimary(): Promise<RegionHealth | null>;
  update(regionName: string, health: Partial<RegionHealth>): Promise<void>;
  checkAllRegions(): Promise<{ region: string; status: RegionStatus }[]>;
}

export interface BCDRDashboardStats {
  active_policies: number;
  regions_healthy: number;
  regions_degraded: number;
  regions_offline: number;
  replication_lag_max_seconds: number;
  backups_last_24h: number;
  backups_failed: number;
  failovers_last_30d: number;
  dr_tests_last_90d: number;
  dr_tests_passed_pct: number;
  avg_rto_actual_minutes: number;
  avg_rpo_actual_minutes: number;
}

export interface BCDREngineAPI {
  policies: RecoveryPolicyManagerAPI;
  replication: ReplicationControllerAPI;
  failover: FailoverOrchestratorAPI;
  backups: BackupManagerAPI;
  drTests: DRTestRunnerAPI;
  audit: ContinuityAuditLoggerAPI;
  regions: RegionHealthMonitorAPI;
  getDashboardStats(): Promise<BCDRDashboardStats>;
}
