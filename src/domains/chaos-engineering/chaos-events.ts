/**
 * Chaos Engineering Engine — Kernel Events
 */

export const CHAOS_KERNEL_EVENTS = {
  ExperimentStarted: 'chaos:experiment_started',
  ExperimentCompleted: 'chaos:experiment_completed',
  ExperimentFailed: 'chaos:experiment_failed',
  ExperimentAborted: 'chaos:experiment_aborted',
  SafetyStopTriggered: 'chaos:safety_stop_triggered',
  FaultInjected: 'chaos:fault_injected',
  FaultStopped: 'chaos:fault_stopped',
  SLAValidated: 'chaos:sla_validated',
  SLABreached: 'chaos:sla_breached',
  RTOBreached: 'chaos:rto_breached',
  RPOBreached: 'chaos:rpo_breached',
  FailoverTriggered: 'chaos:failover_triggered',
  SelfHealingTriggered: 'chaos:self_healing_triggered',
  EscalationTriggered: 'chaos:escalation_triggered',
} as const;

export type ChaosKernelEvent = typeof CHAOS_KERNEL_EVENTS[keyof typeof CHAOS_KERNEL_EVENTS];

export interface ChaosExperimentPayload {
  experiment_id: string;
  scenario_id: string | null;
  fault_type: string;
  target_module: string | null;
  target_region: string | null;
  blast_radius: string;
}

export interface ChaosSafetyStopPayload {
  experiment_id: string;
  reason: string;
  triggered_by: string;
}

export interface ChaosValidationPayload {
  experiment_id: string;
  metric: 'sla' | 'rto' | 'rpo';
  target: number;
  actual: number;
  met: boolean;
}

export const __DOMAIN_CATALOG = {
  domain: 'Chaos Engineering',
  color: 'hsl(0 75% 50%)',
  events: [
    { name: 'ExperimentStarted', description: 'Experimento de caos iniciado' },
    { name: 'ExperimentCompleted', description: 'Experimento de caos concluído' },
    { name: 'ExperimentFailed', description: 'Experimento de caos falhou' },
    { name: 'ExperimentAborted', description: 'Experimento abortado manualmente' },
    { name: 'SafetyStopTriggered', description: 'Safety guard ativou parada de emergência' },
    { name: 'FaultInjected', description: 'Falha injetada no sistema' },
    { name: 'FaultStopped', description: 'Injeção de falha interrompida' },
    { name: 'SLAValidated', description: 'SLA validado após experimento' },
    { name: 'SLABreached', description: 'SLA violado durante experimento' },
    { name: 'RTOBreached', description: 'RTO violado durante experimento' },
    { name: 'RPOBreached', description: 'RPO violado durante experimento' },
    { name: 'FailoverTriggered', description: 'Failover disparado pelo experimento' },
    { name: 'SelfHealingTriggered', description: 'Self-healing ativado automaticamente' },
    { name: 'EscalationTriggered', description: 'Escalonamento automático disparado' },
  ],
};
