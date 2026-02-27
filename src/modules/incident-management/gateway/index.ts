/**
 * IncidentManagement Gateway — Domain gateway via sandbox.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createIncidentManagementGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    queryIncidents: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('incidents', 'list', params),
    queryIncident: (id: string) =>
      gateway.query<unknown>('incidents', 'get', { id }),
    createIncident: (data: Record<string, unknown>) =>
      gateway.mutate('incidents', 'create', data),
    updateStatus: (data: Record<string, unknown>) =>
      gateway.mutate('incidents', 'updateStatus', data),
    queryDashboard: () =>
      gateway.query<unknown>('incidents', 'dashboard'),
    queryPostmortems: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('postmortems', 'list', params),
    queryAvailability: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('availability', 'report', params),
  };
}
