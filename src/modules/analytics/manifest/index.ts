export const ANALYTICS_MODULE_ID = 'analytics';

export const ANALYTICS_EVENTS = {
  REPORT_READY: `module:${ANALYTICS_MODULE_ID}:report_ready`,
  ANOMALY_DETECTED: `module:${ANALYTICS_MODULE_ID}:anomaly_detected`,
  DASHBOARD_REFRESHED: `module:${ANALYTICS_MODULE_ID}:dashboard_refreshed`,
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initAnalyticsModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: ANALYTICS_MODULE_ID });
}
