export const LIVE_DISPLAY_MODULE_ID = 'live_display';
export const LIVE_DISPLAY_MODULE_KEY = 'live_display';

export const LIVE_DISPLAY_EVENTS = {
  DISPLAY_PAIRED: `module:${LIVE_DISPLAY_MODULE_ID}:display_paired`,
  DISPLAY_DISCONNECTED: `module:${LIVE_DISPLAY_MODULE_ID}:display_disconnected`,
  DATA_REFRESHED: `module:${LIVE_DISPLAY_MODULE_ID}:data_refreshed`,
} as const;

export const DISPLAY_TIPOS = {
  fleet: { label: 'Frota', description: 'Eventos GPS, rastreamento e infrações de veículos' },
  sst: { label: 'SST', description: 'Saúde e segurança do trabalho, EPIs e NRs' },
  compliance: { label: 'Compliance', description: 'Incidentes, advertências e conformidade' },
  executivo: { label: 'Executivo', description: 'Visão consolidada de workforce e KPIs' },
} as const;

export type DisplayBoardTipo = keyof typeof DISPLAY_TIPOS;

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initLiveDisplayModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.emit('initialized', { module: LIVE_DISPLAY_MODULE_ID });
}
