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
 * ║   └── RevenueMetricsService       ← MRR, churn, receita        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ── Aggregate factory ────────────────────────────────────────
export { createPlatformBillingCore } from './billing-core';

// ── Individual factories ─────────────────────────────────────
export { createBillingCalculator } from './billing-calculator';
export { createFinancialLedgerAdapter } from './financial-ledger-adapter';
export { createInvoiceEngine } from './invoice-engine';
export { createRevenueMetricsService } from './revenue-metrics-service';
export { createSubscriptionLifecycleManager } from './subscription-lifecycle-manager';

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
  InvoiceEngineAPI,

  // Subscription Lifecycle
  SubscriptionLifecycleManagerAPI,

  // Revenue Metrics
  RevenueMetrics,
  RevenueMetricsServiceAPI,

  // Aggregate
  PlatformBillingCoreAPI,
} from './types';
