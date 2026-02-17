/**
 * HR Module — Manifest
 *
 * Declarative contract for the Core HR module.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export const HR_MODULE_ID = 'core_hr';

/** Module-scoped event types */
export const HR_EVENTS = {
  EMPLOYEE_CREATED: `module:${HR_MODULE_ID}:employee_created`,
  EMPLOYEE_UPDATED: `module:${HR_MODULE_ID}:employee_updated`,
  EMPLOYEE_TERMINATED: `module:${HR_MODULE_ID}:employee_terminated`,
  DEPARTMENT_CHANGED: `module:${HR_MODULE_ID}:department_changed`,
  ORG_CHART_REFRESHED: `module:${HR_MODULE_ID}:org_chart_refreshed`,
} as const;

/** Initialize the HR module within its sandbox */
export function initHrModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: HR_MODULE_ID });
}
