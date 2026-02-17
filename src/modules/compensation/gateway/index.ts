import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createCompensationGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    listSalaryTables: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('salary_tables', 'list', params),
    runSimulation: (data: Record<string, unknown>) =>
      gateway.mutate('simulations', 'create', data),
    getPayrollSummary: () =>
      gateway.query('payroll', 'summary'),
  };
}
