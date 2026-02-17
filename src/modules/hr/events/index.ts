/**
 * HR Module — Events
 *
 * Event handlers and subscriptions for the HR module.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { HR_EVENTS } from '../manifest';

export function registerHrEventHandlers(sandbox: SandboxContext): () => void {
  const unsubs: Array<() => void> = [];

  // Listen for cross-module events that affect HR
  unsubs.push(
    sandbox.on('module:compensation_engine:salary_updated', (payload: any) => {
      sandbox.emit('salary_sync_received', payload);
    }),
  );

  // Cleanup function
  return () => { for (const u of unsubs) u(); };
}

export { HR_EVENTS };
