export const COMPENSATION_MODULE_ID = 'compensation_engine';

export const COMPENSATION_EVENTS = {
  SALARY_UPDATED: `module:${COMPENSATION_MODULE_ID}:salary_updated`,
  SIMULATION_CREATED: `module:${COMPENSATION_MODULE_ID}:simulation_created`,
  MASS_ADJUSTMENT: `module:${COMPENSATION_MODULE_ID}:mass_adjustment`,
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initCompensationModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: COMPENSATION_MODULE_ID });
}
