/**
 * BCDR Engine — Kernel Events
 */

export const BCDR_KERNEL_EVENTS = {
  FailoverInitiated: 'bcdr:failover_initiated',
  FailoverCompleted: 'bcdr:failover_completed',
  FailoverFailed: 'bcdr:failover_failed',
  FailoverRolledBack: 'bcdr:failover_rolled_back',
  ReplicationDegraded: 'bcdr:replication_degraded',
  ReplicationFailed: 'bcdr:replication_failed',
  BackupCompleted: 'bcdr:backup_completed',
  BackupFailed: 'bcdr:backup_failed',
  DRTestPassed: 'bcdr:dr_test_passed',
  DRTestFailed: 'bcdr:dr_test_failed',
  RegionUnhealthy: 'bcdr:region_unhealthy',
  RegionOffline: 'bcdr:region_offline',
  RTOBreached: 'bcdr:rto_breached',
  RPOBreached: 'bcdr:rpo_breached',
} as const;

export type BCDRKernelEvent = typeof BCDR_KERNEL_EVENTS[keyof typeof BCDR_KERNEL_EVENTS];

export interface FailoverInitiatedPayload {
  failover_id: string;
  policy_id: string;
  source_region: string;
  target_region: string;
  trigger_type: string;
  reason: string;
}

export interface FailoverCompletedPayload {
  failover_id: string;
  rto_actual_minutes: number;
  rpo_actual_minutes: number;
  rto_met: boolean;
  rpo_met: boolean;
}

export interface ReplicationDegradedPayload {
  replication_id: string;
  policy_id: string;
  lag_seconds: number;
  threshold_seconds: number;
}

export interface RegionHealthChangedPayload {
  region_name: string;
  previous_status: string;
  new_status: string;
}

export interface DRTestResultPayload {
  test_id: string;
  test_type: string;
  passed: boolean;
  rto_met: boolean | null;
  rpo_met: boolean | null;
  findings_count: number;
}

export const __DOMAIN_CATALOG = {
  domain: 'Business Continuity & Disaster Recovery',
  color: 'hsl(210 75% 45%)',
  events: [
    { name: 'FailoverInitiated', description: 'Failover automático ou manual iniciado' },
    { name: 'FailoverCompleted', description: 'Failover concluído com sucesso' },
    { name: 'FailoverFailed', description: 'Falha no processo de failover' },
    { name: 'FailoverRolledBack', description: 'Failover revertido' },
    { name: 'ReplicationDegraded', description: 'Replicação com lag acima do limiar' },
    { name: 'ReplicationFailed', description: 'Falha na replicação de dados' },
    { name: 'BackupCompleted', description: 'Backup concluído com sucesso' },
    { name: 'BackupFailed', description: 'Falha no backup' },
    { name: 'DRTestPassed', description: 'Teste de DR aprovado' },
    { name: 'DRTestFailed', description: 'Teste de DR reprovado' },
    { name: 'RegionUnhealthy', description: 'Região com saúde degradada' },
    { name: 'RegionOffline', description: 'Região offline' },
    { name: 'RTOBreached', description: 'RTO violado durante failover' },
    { name: 'RPOBreached', description: 'RPO violado durante failover' },
  ],
};
