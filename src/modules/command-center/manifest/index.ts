export const COMMAND_CENTER_MODULE_ID = 'operational_command_center';

export const COMMAND_CENTER_EVENTS = {
  EVENT_RECEIVED: `module:${COMMAND_CENTER_MODULE_ID}:event_received`,
  ACTION_EXECUTED: `module:${COMMAND_CENTER_MODULE_ID}:action_executed`,
  DRILL_DOWN_OPENED: `module:${COMMAND_CENTER_MODULE_ID}:drill_down_opened`,
  FILTER_CHANGED: `module:${COMMAND_CENTER_MODULE_ID}:filter_changed`,
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initCommandCenterModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: COMMAND_CENTER_MODULE_ID });
}
