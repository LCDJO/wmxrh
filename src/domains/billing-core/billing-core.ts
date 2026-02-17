/**
 * PlatformBillingCore — Aggregate Factory
 *
 * Wires all billing sub-systems together, reusing PXE services
 * for plan registry, tenant resolution, and payment policies.
 */

import type { PlatformExperienceEngineAPI } from '@/domains/platform-experience/types';
import type { ModuleOrchestratorAPI } from '@/domains/platform-os/types';
import type { PlatformBillingCoreAPI } from './types';
import { createBillingCalculator } from './billing-calculator';
import { createFinancialLedgerAdapter } from './financial-ledger-adapter';
import { createInvoiceEngine } from './invoice-engine';
import { createRevenueMetricsService } from './revenue-metrics-service';
import { createSubscriptionLifecycleManager } from './subscription-lifecycle-manager';
import { createModulePlanSyncService } from './module-plan-sync-service';

/**
 * Creates the PlatformBillingCore aggregate by composing PXE services
 * with new billing-specific services.
 */
export function createPlatformBillingCore(
  pxe: PlatformExperienceEngineAPI,
  modules?: ModuleOrchestratorAPI
): PlatformBillingCoreAPI {
  const calculator = createBillingCalculator(pxe.plans, pxe.tenantPlan);
  const ledger = createFinancialLedgerAdapter();
  const invoices = createInvoiceEngine();
  const revenue = createRevenueMetricsService();

  // Module sync: auto-activate/deactivate modules when plan changes
  const modulePlanSync = modules
    ? createModulePlanSyncService(modules, pxe.plans)
    : undefined;

  const subscriptionLifecycle = createSubscriptionLifecycleManager(
    pxe.lifecycle,
    calculator,
    invoices,
    ledger,
    pxe.payment,
    modulePlanSync
  );

  return {
    planRegistry: pxe.plans,
    tenantPlan: pxe.tenantPlan,
    calculator,
    paymentPolicy: pxe.payment,
    subscriptionLifecycle,
    ledger,
    invoices,
    revenue,
    _planLifecycle: pxe.lifecycle,
  };
}
