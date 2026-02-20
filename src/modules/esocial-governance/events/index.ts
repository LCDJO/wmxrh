/**
 * eSocial Governance Module — Events
 *
 * Cross-module event handlers and subscriptions.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { ESOCIAL_GOV_EVENTS } from '../manifest';

export function registerEsocialGovEventHandlers(sandbox: SandboxContext): () => void {
  const unsubs: Array<() => void> = [];

  // Listen for safety automation signals that affect governance
  unsubs.push(
    sandbox.on('module:safety_automation:signal_processed', (payload: unknown) => {
      sandbox.emit(ESOCIAL_GOV_EVENTS.ALERT_GENERATED, payload);
    }),
  );

  // Listen for regulatory intelligence norm changes
  unsubs.push(
    sandbox.on('module:regulatory_intelligence:norm_changed', (payload: unknown) => {
      sandbox.emit(ESOCIAL_GOV_EVENTS.LAYOUT_CHANGED, payload);
    }),
  );

  return () => { for (const u of unsubs) u(); };
}

export { ESOCIAL_GOV_EVENTS };
