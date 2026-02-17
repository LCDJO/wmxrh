export const TENANT_MODULE_ID = 'tenant_admin';

export const TENANT_EVENTS = {
  USER_INVITED: `module:${TENANT_MODULE_ID}:user_invited`,
  ROLE_ASSIGNED: `module:${TENANT_MODULE_ID}:role_assigned`,
  MODULE_TOGGLED: `module:${TENANT_MODULE_ID}:module_toggled`,
  SETTINGS_UPDATED: `module:${TENANT_MODULE_ID}:settings_updated`,
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initTenantModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: TENANT_MODULE_ID });
}
