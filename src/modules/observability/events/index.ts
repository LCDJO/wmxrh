/**
 * ObservabilityModule — Event handlers for cross-module integration.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { OBSERVABILITY_EVENTS } from '../manifest';

export function registerObservabilityEventHandlers(sandbox: SandboxContext): () => void {
  const unsubs: Array<() => void> = [];

  // Listen for module lifecycle events to auto-register health tracking
  unsubs.push(
    sandbox.on('platform:module_registered', (payload: any) => {
      sandbox.emit(OBSERVABILITY_EVENTS.HEALTH_CHECK_COMPLETED, {
        module: payload.key,
        status: 'registered',
      });
    }),
  );

  return () => unsubs.forEach(fn => fn());
}
