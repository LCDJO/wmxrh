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
  // Marketing Digital OS
  FunnelCreated: 'observability:funnel_created',
  FunnelActivated: 'observability:funnel_activated',
  AIOptimizationSuggested: 'observability:ai_optimization_suggested',
  PipelineConversionUpdated: 'observability:pipeline_conversion_updated',
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

// ── Marketing Digital OS Payloads ───────────────────────────────

export interface FunnelCreatedPayload {
  funnel_id: string;
  funnel_name: string;
  stages: string[];
}

export interface FunnelActivatedPayload {
  funnel_id: string;
  funnel_name: string;
  stage_count: number;
}

export interface AIOptimizationSuggestedPayload {
  suggestion_id: string;
  target_type: 'funnel' | 'landing' | 'campaign' | 'headline';
  target_id: string;
  predicted_lift: number;
  title: string;
}

export interface PipelineConversionUpdatedPayload {
  funnel_id: string;
  stage_from: string;
  stage_to: string;
  conversion_rate: number;
  previous_rate?: number;
}
