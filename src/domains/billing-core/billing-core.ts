/**
 * PlatformBillingCore — Aggregate Factory
 *
 * Wires all billing sub-systems together, reusing PXE services
 * for plan registry, tenant resolution, and payment policies.
 */

import type { PlatformExperienceEngineAPI } from '@/domains/platform-experience/types';
import type { ModuleOrchestratorAPI, GlobalEventKernelAPI } from '@/domains/platform-os/types';
import type { PlatformBillingCoreAPI } from './types';
import { createBillingCalculator } from './billing-calculator';
import { createFinancialLedgerAdapter } from './financial-ledger-adapter';
import { createInvoiceEngine } from './invoice-engine';
import { createRevenueMetricsService } from './revenue-metrics-service';
import { createSubscriptionLifecycleManager } from './subscription-lifecycle-manager';
import { createModulePlanSyncService } from './module-plan-sync-service';
import { createUsageBillingEngine } from './usage-billing-engine';
import { createUsageEventBridge } from './usage-event-bridge';
import { createCouponPolicyResolver } from './coupon-policy-resolver';
import { createPlanApplicationOrchestrator } from './plan-application-orchestrator';
import {
  createCouponManager,
  createCouponValidationService,
  createCouponLifecycleManager,
  createDiscountEngine,
  createBillingAdjustmentService,
} from './coupon-discount-engine';

/**
 * Creates the PlatformBillingCore aggregate by composing PXE services
 * with new billing-specific services.
 */
export function createPlatformBillingCore(
  pxe: PlatformExperienceEngineAPI,
  modules?: ModuleOrchestratorAPI,
  events?: GlobalEventKernelAPI,
): PlatformBillingCoreAPI {
  const calculator = createBillingCalculator(pxe.plans, pxe.tenantPlan);
  const ledger = createFinancialLedgerAdapter();
  const invoices = createInvoiceEngine();
  const revenue = createRevenueMetricsService();

  // Usage-based billing
  const usage = createUsageBillingEngine();

  // Event bridge: auto-record usage from GlobalEventKernel
  if (events) {
    const bridge = createUsageEventBridge(events, usage.collector);
    bridge.start();
  }

  // Coupon & discount engine
  const coupons = createCouponManager();
  const couponValidation = createCouponValidationService();
  const couponLifecycle = createCouponLifecycleManager();
  const discounts = createDiscountEngine();
  const adjustments = createBillingAdjustmentService();
  const couponPolicy = createCouponPolicyResolver();
  const planOrchestrator = createPlanApplicationOrchestrator();
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
    modulePlanSync,
    discounts,
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
    usage,
    coupons,
    couponValidation,
    couponLifecycle,
    discounts,
    adjustments,
    couponPolicy,
    planOrchestrator,
    _planLifecycle: pxe.lifecycle,
  };
}
