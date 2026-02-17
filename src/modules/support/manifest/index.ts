export const SUPPORT_MODULE_ID = 'customer_support';

export const SUPPORT_MODULE_EVENTS = {
  TICKET_CREATED: `module:${SUPPORT_MODULE_ID}:ticket_created`,
  TICKET_RESOLVED: `module:${SUPPORT_MODULE_ID}:ticket_resolved`,
  WIKI_PUBLISHED: `module:${SUPPORT_MODULE_ID}:wiki_published`,
  AGENT_EVALUATED: `module:${SUPPORT_MODULE_ID}:agent_evaluated`,
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initSupportModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: SUPPORT_MODULE_ID });
}
