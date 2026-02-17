/**
 * HR Module — Domain Gateway
 *
 * All data access for the HR module goes through the sandbox gateway.
 * Direct Supabase/DB imports are FORBIDDEN.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createHrGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;

  return {
    /** List employees with optional filters */
    listEmployees: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('employees', 'list', params),

    /** Get employee by ID */
    getEmployee: (id: string) =>
      gateway.query('employees', 'getById', { id }),

    /** Create a new employee */
    createEmployee: (data: Record<string, unknown>) =>
      gateway.mutate('employees', 'create', data),

    /** Update an employee */
    updateEmployee: (id: string, data: Record<string, unknown>) =>
      gateway.mutate('employees', 'update', { id, ...data }),

    /** List departments */
    listDepartments: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('departments', 'list', params),

    /** Subscribe to employee changes */
    onEmployeeChange: (handler: (data: unknown) => void) =>
      gateway.subscribe('employees', 'change', handler),
  };
}
