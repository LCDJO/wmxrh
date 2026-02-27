/**
 * IncidentManagementModule — Manifest
 */
export const INCIDENT_MODULE_ID = 'incident-management';

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initIncidentManagementModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.state.set('sla_check_interval_ms', 60_000);
  sandbox.emit('initialized', { module: INCIDENT_MODULE_ID });
}
