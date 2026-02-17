/**
 * PlatformBillingCore — Domain Types
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

import type {
  PlanRegistryAPI,
  TenantPlanResolverAPI,
  PaymentPolicyEngineAPI,
  PlanLifecycleManagerAPI,
  PlanTier,
  BillingCycle,
  PaymentMethod,
} from '@/domains/platform-experience/types';

// Re-export for convenience
export type { PlanTier, BillingCycle, PaymentMethod };

// ══════════════════════════════════════════════════════════════════
// Invoice
// ══════════════════════════════════════════════════════════════════

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface Invoice {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  subscription_id: string | null;
  total_amount: number;
  currency: string;
  billing_period_start: string; // DATE
  billing_period_end: string;
  status: InvoiceStatus;
  payment_method: PaymentMethod | 'manual' | null;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceDTO {
  tenant_id: string;
  plan_id?: string;
  subscription_id?: string;
  total_amount: number;
  currency?: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  payment_method?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════
// Billing Calculator
// ══════════════════════════════════════════════════════════════════

export interface BillingLineItem {
  description: string;
  quantity: number;
  unit_price_brl: number;
  total_brl: number;
  type: 'plan_base' | 'per_user' | 'per_employee' | 'addon' | 'proration' | 'discount' | 'setup' | 'usage' | 'coupon_discount';
}

export interface BillingCalculation {
  tenant_id: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  line_items: BillingLineItem[];
  subtotal_brl: number;
  discount_brl: number;
  total_brl: number;
  period_start: string;
  period_end: string;
  calculated_at: number;
}

export interface PlanChangeBreakdown {
  /** Valor proporcional (prorata) a cobrar/creditar na mudança */
  proration: BillingCalculation;
  /** Valor recorrente do novo plano (ciclo cheio) */
  recurring: BillingCalculation;
  /** Projeção dos próximos N ciclos */
  next_cycles: { cycle_number: number; period_start: string; period_end: string; total_brl: number }[];
  /** Dias restantes do ciclo atual */
  remaining_days: number;
  /** Dias totais do ciclo atual */
  total_cycle_days: number;
}

export interface BillingCalculatorAPI {
  /** Calculate the full billing amount for a tenant's current plan */
  calculate(tenantId: string): BillingCalculation;
  /** Calculate for a specific plan (preview / simulation) */
  calculateForPlan(tenantId: string, planId: string, cycle: BillingCycle): BillingCalculation;
  /** Calculate proration for a plan change */
  calculateProration(tenantId: string, fromPlanId: string, toPlanId: string): BillingCalculation;
  /** Full plan-change breakdown: prorata + recurring + next cycles */
  calculatePlanChange(tenantId: string, fromPlanId: string, toPlanId: string, opts?: { preview_cycles?: number }): PlanChangeBreakdown;
}

// ══════════════════════════════════════════════════════════════════
// Financial Ledger
// ══════════════════════════════════════════════════════════════════

export type LedgerEntryType = 'charge' | 'payment' | 'refund' | 'credit' | 'adjustment';

export interface LedgerEntry {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  entry_type: LedgerEntryType;
  amount_brl: number;
  balance_after_brl: number;
  description: string;
  reference_id: string | null;
  created_at: number;
}

export interface FinancialLedgerAdapterAPI {
  /** Record a charge (invoice issued) */
  recordCharge(tenantId: string, invoiceId: string, amount: number, description: string): LedgerEntry;
  /** Record a payment received */
  recordPayment(tenantId: string, invoiceId: string, amount: number, method: string): LedgerEntry;
  /** Record a refund */
  recordRefund(tenantId: string, invoiceId: string, amount: number, reason: string): LedgerEntry;
  /** Record a credit adjustment */
  recordCredit(tenantId: string, amount: number, description: string): LedgerEntry;
  /** Get tenant balance */
  getBalance(tenantId: string): number;
  /** Get ledger history */
  getHistory(tenantId: string, limit?: number): LedgerEntry[];
}

// ══════════════════════════════════════════════════════════════════
// Invoice Engine
// ══════════════════════════════════════════════════════════════════

export interface InvoiceEngineAPI {
  /** Generate a new invoice for a tenant */
  generate(tenantId: string, dto: CreateInvoiceDTO): Promise<Invoice>;
  /** Get invoice by ID */
  getById(invoiceId: string): Promise<Invoice | null>;
  /** List invoices for a tenant */
  listByTenant(tenantId: string, opts?: { status?: InvoiceStatus; limit?: number }): Promise<Invoice[]>;
  /** List all invoices (platform) */
  listAll(opts?: { status?: InvoiceStatus; limit?: number; offset?: number }): Promise<Invoice[]>;
  /** Mark invoice as paid */
  markPaid(invoiceId: string, paidAt?: string, method?: string): Promise<Invoice>;
  /** Cancel invoice */
  cancel(invoiceId: string): Promise<Invoice>;
  /** Mark invoice as overdue (batch operation) */
  markOverdueInvoices(): Promise<number>;
  /** Get pending amount for tenant */
  getPendingAmount(tenantId: string): Promise<number>;
}

// ══════════════════════════════════════════════════════════════════
// Subscription Lifecycle Manager (wraps PXE lifecycle + billing)
// ══════════════════════════════════════════════════════════════════

export interface SubscriptionLifecycleManagerAPI {
  /** Activate a subscription (generate first invoice) */
  activate(tenantId: string, planId: string, cycle: BillingCycle): Promise<void>;
  /** Upgrade plan (prorate + new invoice) */
  upgrade(tenantId: string, toPlanId: string): Promise<void>;
  /** Downgrade plan (effective next cycle) */
  downgrade(tenantId: string, toPlanId: string): Promise<void>;
  /** Suspend for non-payment */
  suspend(tenantId: string, reason: string): Promise<void>;
  /** Cancel subscription */
  cancel(tenantId: string, reason: string): Promise<void>;
  /** Reactivate */
  reactivate(tenantId: string): Promise<void>;
  /** Process renewal (generate next invoice) */
  processRenewal(tenantId: string): Promise<Invoice>;
}

// ══════════════════════════════════════════════════════════════════
// Revenue Metrics Service
// ══════════════════════════════════════════════════════════════════

export interface RevenueMetrics {
  /** Monthly Recurring Revenue */
  mrr_brl: number;
  /** Annual Recurring Revenue */
  arr_brl: number;
  /** Total revenue collected in period */
  revenue_brl: number;
  /** Revenue pending collection */
  pending_brl: number;
  /** Number of paying tenants */
  paying_tenants: number;
  /** Average Revenue Per Account */
  arpa_brl: number;
  /** Churn rate (%) */
  churn_rate_pct: number;
  /** Net Revenue Retention (%) */
  nrr_pct: number;
  /** Revenue by plan tier */
  revenue_by_plan: { plan: string; tier: PlanTier; mrr: number; count: number }[];
  /** Revenue by payment method */
  revenue_by_method: { method: string; total: number; count: number }[];
  /** Invoice aging (overdue breakdown) */
  aging: { bucket: string; count: number; total_brl: number }[];
  calculated_at: number;
}

export interface RevenueMetricsServiceAPI {
  /** Get current revenue metrics snapshot */
  getMetrics(): Promise<RevenueMetrics>;
  /** Get MRR trend over N months */
  getMRRTrend(months: number): Promise<{ month: string; mrr: number }[]>;
  /** Get churn trend */
  getChurnTrend(months: number): Promise<{ month: string; churn_rate: number; churned: number }[]>;
  /** Get revenue forecast */
  getForecast(months: number): Promise<{ month: string; projected_mrr: number; projected_arr: number }[]>;
}

// ══════════════════════════════════════════════════════════════════
// Usage-Based Billing
// ══════════════════════════════════════════════════════════════════

export interface UsageRecord {
  id: string;
  tenant_id: string;
  metric_key: string;
  quantity: number;
  unit: string;
  recorded_at: string;
  billing_period_start: string;
  billing_period_end: string;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UsageAggregate {
  tenant_id: string;
  metric_key: string;
  total_quantity: number;
  unit: string;
  period_start: string;
  period_end: string;
  record_count: number;
}

export interface UsagePricingTier {
  id: string;
  plan_id: string;
  metric_key: string;
  tier_start: number;
  tier_end: number | null;
  unit_price_brl: number;
  flat_fee_brl: number;
  included_quantity: number;
  pricing_model: 'tiered' | 'volume' | 'graduated' | 'flat';
  is_active: boolean;
}

export interface UsageCostLineItem {
  metric_key: string;
  quantity: number;
  unit: string;
  unit_price_brl: number;
  total_brl: number;
  tiers_applied: number;
  pricing_model: string;
}

export interface UsageCostBreakdown {
  plan_id: string;
  line_items: UsageCostLineItem[];
  total_usage_brl: number;
  calculated_at: number;
}

export interface UsageCollectorAPI {
  record(tenantId: string, metricKey: string, quantity: number, opts?: {
    unit?: string;
    billing_period_start?: string;
    billing_period_end?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<UsageRecord>;
  recordBatch(tenantId: string, records: Array<{
    metric_key: string;
    quantity: number;
    unit?: string;
    billing_period_start: string;
    billing_period_end: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }>): Promise<UsageRecord[]>;
  getByTenant(tenantId: string, opts?: {
    metric_key?: string;
    period_start?: string;
    period_end?: string;
    limit?: number;
  }): Promise<UsageRecord[]>;
}

export interface UsageAggregatorAPI {
  aggregate(tenantId: string, periodStart: string, periodEnd: string): Promise<UsageAggregate[]>;
  aggregateMetric(tenantId: string, metricKey: string, periodStart: string, periodEnd: string): Promise<UsageAggregate>;
}

export interface UsagePricingCalculatorAPI {
  getTiers(planId: string, metricKey: string): Promise<UsagePricingTier[]>;
  calculateCost(planId: string, aggregates: UsageAggregate[]): Promise<UsageCostBreakdown>;
  setTiers(planId: string, metricKey: string, tiers: Array<{
    tier_start: number;
    tier_end?: number | null;
    unit_price_brl: number;
    flat_fee_brl?: number;
    included_quantity?: number;
    pricing_model?: string;
  }>): Promise<void>;
}

export interface UsageBillingEngineAPI {
  collector: UsageCollectorAPI;
  aggregator: UsageAggregatorAPI;
  pricing: UsagePricingCalculatorAPI;
  calculateTenantUsageCost(tenantId: string, planId: string, periodStart: string, periodEnd: string): Promise<UsageCostBreakdown>;
}

// ══════════════════════════════════════════════════════════════════
// Coupons & Discounts
// ══════════════════════════════════════════════════════════════════

export type CouponStatus = 'active' | 'paused' | 'expired' | 'exhausted' | 'archived';
export type DiscountType = 'percentage' | 'fixed_amount' | 'free_months';

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_brl: number | null;
  currency: string;
  applicable_plan_ids: string[] | null;
  applicable_billing_cycles: string[] | null;
  min_plan_tier: string | null;
  max_redemptions: number | null;
  max_redemptions_per_tenant: number;
  current_redemptions: number;
  valid_from: string;
  valid_until: string | null;
  duration_months: number | null;
  status: CouponStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponDTO {
  code: string;
  name: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_brl?: number;
  applicable_plan_ids?: string[];
  applicable_billing_cycles?: string[];
  min_plan_tier?: string;
  max_redemptions?: number;
  max_redemptions_per_tenant?: number;
  valid_from?: string;
  valid_until?: string;
  duration_months?: number;
  created_by?: string;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  tenant_id: string;
  plan_id: string | null;
  invoice_id: string | null;
  discount_applied_brl: number;
  billing_cycles_remaining: number | null;
  status: 'active' | 'fully_applied' | 'cancelled' | 'expired';
  redeemed_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  coupon?: Coupon;
}

export interface DiscountApplication {
  applied: boolean;
  reason?: string;
  coupon?: Coupon;
  redemption?: CouponRedemption;
  discount_brl: number;
  final_amount_brl: number;
}

export interface BillingAdjustment {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  coupon_redemption_id: string | null;
  adjustment_type: string;
  amount_brl: number;
  description: string;
  applied_at: string;
  applied_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CouponManagerAPI {
  create(dto: CreateCouponDTO): Promise<Coupon>;
  getById(couponId: string): Promise<Coupon | null>;
  getByCode(code: string): Promise<Coupon | null>;
  listAll(opts?: { status?: CouponStatus; limit?: number }): Promise<Coupon[]>;
  update(couponId: string, updates: Partial<CreateCouponDTO & { status: CouponStatus }>): Promise<Coupon>;
  archive(couponId: string): Promise<Coupon>;
}

export interface CouponValidationServiceAPI {
  validate(code: string, tenantId: string, planId?: string, billingCycle?: string): Promise<CouponValidationResult>;
}

export interface CouponLifecycleManagerAPI {
  expireExpiredCoupons(): Promise<number>;
  decrementCyclesRemaining(): Promise<number>;
  getActiveRedemptions(tenantId: string): Promise<CouponRedemption[]>;
}

export interface DiscountEngineAPI {
  applyDiscount(code: string, tenantId: string, subtotalBrl: number, planId?: string, billingCycle?: string): Promise<DiscountApplication>;
  getActiveDiscounts(tenantId: string): Promise<Array<{
    redemption_id: string;
    coupon_code: string;
    coupon_name: string;
    discount_type: DiscountType;
    discount_value: number;
    discount_applied_brl: number;
    cycles_remaining: number | null;
  }>>;
  calculateRecurringDiscount(tenantId: string, subtotalBrl: number): Promise<number>;
}

export interface BillingAdjustmentServiceAPI {
  create(tenantId: string, dto: {
    invoice_id?: string;
    coupon_redemption_id?: string;
    adjustment_type: string;
    amount_brl: number;
    description: string;
    applied_by?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BillingAdjustment>;
  listByTenant(tenantId: string, opts?: { adjustment_type?: string; limit?: number }): Promise<BillingAdjustment[]>;
  listByInvoice(invoiceId: string): Promise<BillingAdjustment[]>;
  getTotalAdjustments(tenantId: string): Promise<number>;
}

// ══════════════════════════════════════════════════════════════════
// Aggregate: PlatformBillingCore API
// ══════════════════════════════════════════════════════════════════

export interface PlatformBillingCoreAPI {
  /** Reuses PXE PlanRegistry */
  planRegistry: PlanRegistryAPI;
  /** Reuses PXE TenantPlanResolver */
  tenantPlan: TenantPlanResolverAPI;
  /** Calculates billing amounts */
  calculator: BillingCalculatorAPI;
  /** Reuses PXE PaymentPolicyEngine */
  paymentPolicy: PaymentPolicyEngineAPI;
  /** Manages subscription lifecycle with billing side-effects */
  subscriptionLifecycle: SubscriptionLifecycleManagerAPI;
  /** Financial ledger for accounting */
  ledger: FinancialLedgerAdapterAPI;
  /** Invoice generation and management */
  invoices: InvoiceEngineAPI;
  /** Revenue metrics and analytics */
  revenue: RevenueMetricsServiceAPI;
  /** Usage-based billing */
  usage: UsageBillingEngineAPI;
  /** Coupon management */
  coupons: CouponManagerAPI;
  /** Coupon validation */
  couponValidation: CouponValidationServiceAPI;
  /** Coupon lifecycle */
  couponLifecycle: CouponLifecycleManagerAPI;
  /** Discount engine */
  discounts: DiscountEngineAPI;
  /** Billing adjustments */
  adjustments: BillingAdjustmentServiceAPI;
  /** Reuses PXE lifecycle (internal) */
  _planLifecycle: PlanLifecycleManagerAPI;
}
