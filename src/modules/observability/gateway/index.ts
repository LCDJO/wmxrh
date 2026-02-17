/**
 * ObservabilityGateway — Domain gateway via sandbox.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createObservabilityGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    queryHealth: () =>
      gateway.query<unknown>('health', 'summary'),
    queryErrors: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('errors', 'list', params),
    queryMetrics: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('metrics', 'query', params),
    exportMetrics: (data: Record<string, unknown>) =>
      gateway.mutate('metrics', 'export', data),
    queryLogs: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('logs', 'stream', params),
  };
}
