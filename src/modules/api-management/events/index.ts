/**
 * PAMS Event Handlers — Cross-module event integration.
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { PAMS_EVENTS } from '../manifest';

export function registerApiManagementEventHandlers(sandbox: SandboxContext): () => void {
  const unsubscribers: Array<() => void> = [];

  // Listen for billing plan changes to update rate limits
  const unsubPlanChange = sandbox.on('module:billing:plan_changed', (payload: unknown) => {
    const data = payload as { tenantId: string; newPlan: string };
    console.info(`[PAMS] Plan changed for tenant ${data.tenantId} → ${data.newPlan}. Rate limits will be recalculated.`);
    sandbox.emit(PAMS_EVENTS.USAGE_THRESHOLD, {
      type: 'plan_change',
      tenantId: data.tenantId,
      newPlan: data.newPlan,
    });
  });
  unsubscribers.push(unsubPlanChange);

  // Listen for security events (key compromise, scope violations)
  const unsubSecurity = sandbox.on('module:security:access_denied', (payload: unknown) => {
    const data = payload as { resource: string; userId: string };
    console.warn(`[PAMS] Security event — access denied for ${data.userId} on ${data.resource}`);
    sandbox.emit(PAMS_EVENTS.SCOPE_VIOLATION, data);
  });
  unsubscribers.push(unsubSecurity);

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
