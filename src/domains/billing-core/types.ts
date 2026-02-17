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
  type: 'plan_base' | 'per_user' | 'per_employee' | 'addon' | 'proration' | 'discount' | 'setup';
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
  /** Reuses PXE lifecycle (internal) */
  _planLifecycle: PlanLifecycleManagerAPI;
}
