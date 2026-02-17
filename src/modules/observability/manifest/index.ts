/**
 * PlatformObservabilityModule — Manifest
 *
 * Provides real-time platform monitoring, error tracking,
 * module health, and performance profiling.
 */
export const OBSERVABILITY_MODULE_ID = 'observability';

export const OBSERVABILITY_EVENTS = {
  HEALTH_CHECK_COMPLETED: `module:${OBSERVABILITY_MODULE_ID}:health_check_completed`,
  ERROR_CAPTURED: `module:${OBSERVABILITY_MODULE_ID}:error_captured`,
  PERFORMANCE_SAMPLED: `module:${OBSERVABILITY_MODULE_ID}:performance_sampled`,
  METRICS_EXPORTED: `module:${OBSERVABILITY_MODULE_ID}:metrics_exported`,
  LOG_STREAM_FLUSHED: `module:${OBSERVABILITY_MODULE_ID}:log_stream_flushed`,
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initObservabilityModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.state.set('auto_refresh_interval_ms', 10_000);
  sandbox.emit('initialized', { module: OBSERVABILITY_MODULE_ID });
}
