import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createTenantGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    listUsers: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('users', 'list', params),
    assignRole: (userId: string, roleId: string) =>
      gateway.mutate('roles', 'assign', { userId, roleId }),
    getAuditLog: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('audit_logs', 'list', params),
  };
}
