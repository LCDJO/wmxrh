import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createAnalyticsGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    queryMetrics: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('metrics', 'query', params),
    listDashboards: () =>
      gateway.query<unknown[]>('dashboards', 'list'),
    createReport: (data: Record<string, unknown>) =>
      gateway.mutate('reports', 'create', data),
  };
}
