export const LIVE_DISPLAY_MODULE_ID = 'live_display';
export const LIVE_DISPLAY_MODULE_KEY = 'live_display';

export const LIVE_DISPLAY_EVENTS = {
  DISPLAY_PAIRED: `module:${LIVE_DISPLAY_MODULE_ID}:display_paired`,
  DISPLAY_DISCONNECTED: `module:${LIVE_DISPLAY_MODULE_ID}:display_disconnected`,
  DATA_REFRESHED: `module:${LIVE_DISPLAY_MODULE_ID}:data_refreshed`,
} as const;

export const DISPLAY_LAYOUTS = {
  operations: { label: 'Operações', description: 'Mapa GPS, eventos de frota e workforce' },
  compliance: { label: 'Compliance', description: 'Incidentes, infrações e alertas críticos' },
  overview: { label: 'Visão Geral', description: 'Todos os widgets em layout consolidado' },
} as const;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initLiveDisplayModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: LIVE_DISPLAY_MODULE_ID });
}
