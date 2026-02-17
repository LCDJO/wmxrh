export const ADS_MODULE_ID = 'ads';

export const ADS_EVENTS = {
  CAMPAIGN_CREATED: `module:${ADS_MODULE_ID}:campaign_created`,
  CAMPAIGN_PAUSED: `module:${ADS_MODULE_ID}:campaign_paused`,
  REPORT_GENERATED: `module:${ADS_MODULE_ID}:report_generated`,
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initAdsModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: ADS_MODULE_ID });
}
