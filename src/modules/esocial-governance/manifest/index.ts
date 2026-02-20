/**
 * eSocial Governance Module — Manifest
 *
 * Declarative contract for the eSocial Governance & Monitoring Center.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export const ESOCIAL_GOV_MODULE_ID = 'esocial_governance';

/** Module-scoped event types */
export const ESOCIAL_GOV_EVENTS = {
  LAYOUT_CHANGED: `module:${ESOCIAL_GOV_MODULE_ID}:layout_changed`,
  TENANT_STATUS_CHANGED: `module:${ESOCIAL_GOV_MODULE_ID}:tenant_status_changed`,
  ALERT_GENERATED: `module:${ESOCIAL_GOV_MODULE_ID}:alert_generated`,
  CERTIFICATE_EXPIRING: `module:${ESOCIAL_GOV_MODULE_ID}:certificate_expiring`,
  CRITICAL_ERROR_WORKFLOW: `module:${ESOCIAL_GOV_MODULE_ID}:critical_error_workflow`,
  AUDIT_LOGGED: `module:${ESOCIAL_GOV_MODULE_ID}:audit_logged`,
} as const;

/** Initialize the eSocial Governance module within its sandbox */
export function initEsocialGovModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: ESOCIAL_GOV_MODULE_ID });
}
