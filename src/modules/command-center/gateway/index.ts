import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createCommandCenterGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    listEvents: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('events', 'list', params),
    getEmployeeProfile: (employeeId: string) =>
      gateway.query<unknown>('employees', 'get', { id: employeeId }),
    executeAction: (actionType: string, payload: Record<string, unknown>) =>
      gateway.mutate('actions', 'execute', { actionType, ...payload }),
  };
}
