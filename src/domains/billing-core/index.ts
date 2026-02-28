/**
 * PlatformBillingCore — Barrel Export
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PlatformBillingCore                                            ║
 * ║   ├── PlanRegistryService         ← Catálogo de planos (PXE)   ║
 * ║   ├── TenantPlanService           ← Resolve plano (PXE)        ║
 * ║   ├── BillingCalculator           ← Cálculo de valores         ║
 * ║   ├── PaymentPolicyEngine         ← Regras de pagamento (PXE)  ║
 * ║   ├── SubscriptionLifecycleManager← Lifecycle de assinatura    ║
 * ║   ├── FinancialLedgerAdapter      ← Registro contábil          ║
 * ║   ├── InvoiceEngine               ← Geração de faturas         ║
 * ║   ├── RevenueMetricsService       ← MRR, churn, receita        ║
 * ║   ├── UsageBillingEngine          ← Cobrança por uso           ║
 * ║   ├── CouponManager              ← CRUD cupons                 ║
 * ║   ├── DiscountEngine              ← Aplicação de descontos     ║
 * ║   └── BillingAdjustmentService    ← Ajustes financeiros        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ── Aggregate factory ────────────────────────────────────────
export { createPlatformBillingCore } from './billing-core';

// ── Individual factories ─────────────────────────────────────
export { createBillingCalculator, calculateInvoiceTotal, calculateTenantTotal } from './billing-calculator';
export { createFinancialLedgerAdapter } from './financial-ledger-adapter';
export { createInvoiceEngine } from './invoice-engine';
export { createRevenueMetricsService } from './revenue-metrics-service';
export { createSubscriptionLifecycleManager } from './subscription-lifecycle-manager';
export { createUsageBillingEngine } from './usage-billing-engine';
export {
  createCouponManager,
  createCouponValidationService,
  createCouponLifecycleManager,
  createDiscountEngine,
  createBillingAdjustmentService,
} from './coupon-discount-engine';
export { createUsageEventBridge, USAGE_EVENTS } from './usage-event-bridge';
export { createCouponPolicyResolver } from './coupon-policy-resolver';
export type {
  CouponPolicyResult,
  CouponPolicyResolverAPI,
} from './coupon-policy-resolver';
export type {
  UsageEventBridgeAPI,
  UserCreatedPayload,
  APICallExecutedPayload,
  WorkflowRunPayload,
  StorageUpdatedPayload,
} from './usage-event-bridge';

// ── Domain Events ────────────────────────────────────────────
export {
  emitBillingEvent,
  onBillingEvent,
  onBillingEventType,
  getBillingEventLog,
  clearBillingEventLog,
} from './billing-events';
export type {
  BillingEventType,
  BillingDomainEvent,
  TenantPlanAssignedEvent,
  TenantPlanUpgradedEvent,
  InvoiceGeneratedEvent,
  RevenueUpdatedEvent,
  UsageRecordedEvent,
  CouponCreatedEvent,
  CouponRedeemedEvent,
  InvoiceDiscountAppliedEvent,
  UsageOverageCalculatedEvent,
} from './billing-events';

// ── Types ────────────────────────────────────────────────────
export type {
  // Invoice
  Invoice,
  InvoiceStatus,
  CreateInvoiceDTO,

  // Billing Calculator
  BillingLineItem,
  BillingCalculation,
  BillingCalculatorAPI,

  // Financial Ledger
  LedgerEntry,
  LedgerEntryType,
  FinancialLedgerAdapterAPI,

  // Invoice Engine
  InvoiceLine,
  InvoiceLineSource,
  InvoiceEngineAPI,

  // Subscription Lifecycle
  SubscriptionLifecycleManagerAPI,

  // Revenue Metrics
  RevenueMetrics,
  RevenueMetricsServiceAPI,

  // Usage-Based Billing
  UsageMetricType,
  UsageRecord,
  UsageAggregate,
  UsagePricingTier,
  UsagePricingRule,
  UsageCostLineItem,
  UsageCostBreakdown,
  UsageCollectorAPI,
  UsageAggregatorAPI,
  UsagePricingCalculatorAPI,
  UsageBillingEngineAPI,

  // Coupons & Discounts
  Coupon,
  CouponStatus,
  CouponAppliesTo,
  DiscountType,
  CreateCouponDTO,
  CouponRedemption,
  CouponValidationResult,
  DiscountApplication,
  BillingAdjustment,
  CouponManagerAPI,
  CouponValidationServiceAPI,
  CouponValidationOpts,
  CouponLifecycleManagerAPI,
  DiscountEngineAPI,
  BillingAdjustmentServiceAPI,

  // Aggregate
  PlatformBillingCoreAPI,
} from './types';
