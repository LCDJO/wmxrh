/**
 * Canonical Observability Events — emitted through GlobalEventKernel.
 *
 * These are the standard events that other layers (Self-Healing, Governance, etc.)
 * subscribe to for cross-cutting integration.
 */

export const OBSERVABILITY_KERNEL_EVENTS = {
  /** Fired when a module's health status changes (healthy→degraded, degraded→down, etc.) */
  ModuleHealthChanged: 'observability:module_health_changed',
  /** Fired when an application error is captured */
  ApplicationErrorDetected: 'observability:application_error_detected',
  /** Fired when a module/gateway latency p95 exceeds threshold */
  LatencyThresholdExceeded: 'observability:latency_threshold_exceeded',
  /** Fired when error rate spikes above normal */
  ErrorRateSpike: 'observability:error_rate_spike',
  /** SCIM: User provisioned via SCIM */
  SCIMUserCreated: 'observability:scim_user_created',
  /** SCIM: User attributes updated via SCIM */
  SCIMUserUpdated: 'observability:scim_user_updated',
  /** SCIM: User deactivated via SCIM */
  SCIMUserDeactivated: 'observability:scim_user_deactivated',
  /** SCIM: Group synced to internal roles */
  SCIMGroupSynced: 'observability:scim_group_synced',
} as const;

export type ObservabilityKernelEvent = typeof OBSERVABILITY_KERNEL_EVENTS[keyof typeof OBSERVABILITY_KERNEL_EVENTS];

// ── Payload types ───────────────────────────────────────────────

export interface ModuleHealthChangedPayload {
  module_id: string;
  module_label: string;
  previous_status: string;
  current_status: string;
  error_count_1h: number;
  latency_ms: number;
}

export interface ApplicationErrorDetectedPayload {
  error_id: string;
  message: string;
  severity: string;
  error_type: string;
  source: string;
  module_id?: string;
  count: number;
}

export interface LatencyThresholdExceededPayload {
  source: string;
  category: string;
  p95_ms: number;
  threshold_ms: number;
  sample_count: number;
}

export interface ErrorRateSpikePayload {
  rate_per_min: number;
  threshold_per_min: number;
  top_module?: string;
  total_errors_1h: number;
}

export interface SCIMUserCreatedPayload {
  tenant_id: string;
  external_id: string;
  email: string;
  role: string;
  scim_client_id: string;
}

export interface SCIMUserUpdatedPayload {
  tenant_id: string;
  external_id: string;
  changed_fields: string[];
  scim_client_id: string;
}

export interface SCIMUserDeactivatedPayload {
  tenant_id: string;
  external_id: string;
  user_id?: string;
  scim_client_id: string;
}

export interface SCIMGroupSyncedPayload {
  tenant_id: string;
  group_name: string;
  mapped_role: string;
  members_affected: number;
  scim_client_id: string;
}

export const __DOMAIN_CATALOG = {
  domain: 'Observability',
  color: 'hsl(35 90% 55%)',
  events: [
    { name: 'ModuleHealthChanged', description: 'Status de saúde do módulo alterado' },
    { name: 'ApplicationErrorDetected', description: 'Erro de aplicação capturado' },
    { name: 'LatencyThresholdExceeded', description: 'Latência p95 acima do threshold' },
    { name: 'ErrorRateSpike', description: 'Pico na taxa de erros' },
    { name: 'SCIMUserCreated', description: 'Usuário provisionado via SCIM' },
    { name: 'SCIMUserUpdated', description: 'Usuário atualizado via SCIM' },
    { name: 'SCIMUserDeactivated', description: 'Usuário desativado via SCIM' },
    { name: 'SCIMGroupSynced', description: 'Grupo SCIM sincronizado com roles' },
  ],
};
