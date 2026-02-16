/**
 * Platform Billing — Future Types
 *
 * Contracts for external billing integration (Stripe, Pagar.me),
 * module marketplace, plan add-ons, and usage-based pricing.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PREPARAÇÃO FUTURA — Nenhum gateway externo conectado ainda.   ║
 * ║  Estes tipos definem os contratos que serão implementados       ║
 * ║  quando o billing externo for ativado.                          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { PlanTier, BillingCycle, PaymentMethod, PaymentStatus } from './types';

// ══════════════════════════════════════════════════════════════════
// 1. External Billing Gateway (Stripe / Pagar.me)
// ══════════════════════════════════════════════════════════════════

export type BillingProvider = 'stripe' | 'pagarme' | 'manual';

export interface BillingGatewayConfig {
  provider: BillingProvider;
  /** Whether this gateway is active */
  enabled: boolean;
  /** Environment: sandbox or production */
  environment: 'sandbox' | 'production';
  /** Webhook endpoint path */
  webhook_path: string;
  /** Supported payment methods for this gateway */
  supported_methods: PaymentMethod[];
  /** Currency code */
  currency: string;
}

/** Represents a customer in the external billing system */
export interface BillingCustomer {
  tenant_id: string;
  external_customer_id: string;
  provider: BillingProvider;
  email: string;
  tax_id?: string; // CNPJ
  metadata?: Record<string, unknown>;
  created_at: number;
}

/** Represents a subscription in the external billing system */
export interface BillingSubscription {
  id: string;
  tenant_id: string;
  external_subscription_id: string;
  provider: BillingProvider;
  plan_id: string;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing' | 'paused';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  billing_cycle: BillingCycle;
  amount_brl: number;
  metadata?: Record<string, unknown>;
}

/** Invoice from the external system */
export interface BillingInvoice {
  id: string;
  tenant_id: string;
  external_invoice_id: string;
  provider: BillingProvider;
  subscription_id: string;
  amount_brl: number;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  due_date: number;
  paid_at: number | null;
  payment_method: PaymentMethod;
  line_items: InvoiceLineItem[];
  pdf_url?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_brl: number;
  total_brl: number;
  type: 'plan' | 'addon' | 'usage' | 'setup' | 'proration';
}

/** Port: External billing gateway adapter */
export interface BillingGatewayPort {
  readonly provider: BillingProvider;

  // Customer
  createCustomer(tenantId: string, email: string, taxId?: string): Promise<BillingCustomer>;
  getCustomer(tenantId: string): Promise<BillingCustomer | null>;
  updateCustomer(tenantId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer>;

  // Subscription
  createSubscription(tenantId: string, planId: string, cycle: BillingCycle): Promise<BillingSubscription>;
  getSubscription(tenantId: string): Promise<BillingSubscription | null>;
  updateSubscription(subscriptionId: string, planId: string): Promise<BillingSubscription>;
  cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<BillingSubscription>;
  pauseSubscription(subscriptionId: string): Promise<BillingSubscription>;
  resumeSubscription(subscriptionId: string): Promise<BillingSubscription>;

  // Invoice
  listInvoices(tenantId: string, limit?: number): Promise<BillingInvoice[]>;
  getInvoice(invoiceId: string): Promise<BillingInvoice | null>;

  // Checkout
  createCheckoutSession(tenantId: string, planId: string, successUrl: string, cancelUrl: string): Promise<{ url: string }>;
  createPortalSession(tenantId: string, returnUrl: string): Promise<{ url: string }>;

  // Webhook
  handleWebhook(payload: unknown, signature: string): Promise<BillingWebhookResult>;
}

export interface BillingWebhookResult {
  event_type: string;
  tenant_id: string | null;
  processed: boolean;
  action?: 'activate' | 'suspend' | 'cancel' | 'update' | 'none';
  metadata?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════
// 2. Module Marketplace
// ══════════════════════════════════════════════════════════════════

export interface MarketplaceModule {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  /** Icon name (lucide) */
  icon: string;
  /** Author / partner */
  publisher: string;
  /** Pricing model */
  pricing_model: 'free' | 'one_time' | 'recurring' | 'usage_based';
  /** Price in BRL (null for free) */
  price_brl: number | null;
  /** Billing cycle for recurring modules */
  billing_cycle?: BillingCycle;
  /** Plans that include this module for free */
  included_in_plans: PlanTier[];
  /** Whether this module is available for purchase */
  is_available: boolean;
  /** Module version */
  version: string;
  /** Required permissions to install */
  required_permissions: string[];
  /** Dependencies on other modules */
  dependencies: string[];
  metadata?: Record<string, unknown>;
}

export interface MarketplaceInstallation {
  id: string;
  tenant_id: string;
  module_id: string;
  module_key: string;
  installed_at: number;
  installed_by: string;
  status: 'active' | 'suspended' | 'uninstalled';
  license_expires_at: number | null;
  pricing_model: MarketplaceModule['pricing_model'];
  metadata?: Record<string, unknown>;
}

export interface ModuleMarketplacePort {
  listAvailable(tenantId: string): Promise<MarketplaceModule[]>;
  getModule(moduleId: string): Promise<MarketplaceModule | null>;
  install(tenantId: string, moduleId: string, installedBy: string): Promise<MarketplaceInstallation>;
  uninstall(tenantId: string, moduleId: string): Promise<void>;
  listInstalled(tenantId: string): Promise<MarketplaceInstallation[]>;
  checkCompatibility(tenantId: string, moduleId: string): Promise<{ compatible: boolean; issues: string[] }>;
}

// ══════════════════════════════════════════════════════════════════
// 3. Plan Add-ons
// ══════════════════════════════════════════════════════════════════

export type AddonType = 'module' | 'quota' | 'feature' | 'support';

export interface PlanAddon {
  id: string;
  name: string;
  description: string;
  type: AddonType;
  /** What the addon provides */
  provides: {
    module_key?: string;
    feature_key?: string;
    quota_key?: string;
    quota_amount?: number;
    support_level?: 'priority' | 'dedicated' | '24x7';
  };
  /** Compatible plan tiers */
  compatible_tiers: PlanTier[];
  /** Price in BRL */
  price_brl: number;
  billing_cycle: BillingCycle;
  /** Whether it can be combined with other addons */
  stackable: boolean;
  /** Max quantity per tenant (null = unlimited) */
  max_quantity: number | null;
  is_active: boolean;
}

export interface TenantAddon {
  id: string;
  tenant_id: string;
  addon_id: string;
  quantity: number;
  status: 'active' | 'cancelled' | 'expired';
  activated_at: number;
  expires_at: number | null;
  cancelled_at: number | null;
  next_billing_at: number | null;
  amount_brl: number;
}

export interface PlanAddonPort {
  listAvailable(planTier: PlanTier): Promise<PlanAddon[]>;
  getAddon(addonId: string): Promise<PlanAddon | null>;
  subscribe(tenantId: string, addonId: string, quantity?: number): Promise<TenantAddon>;
  cancel(tenantId: string, addonId: string): Promise<TenantAddon>;
  listActive(tenantId: string): Promise<TenantAddon[]>;
  calculateTotal(tenantId: string): Promise<{ base_brl: number; addons_brl: number; total_brl: number }>;
}

// ══════════════════════════════════════════════════════════════════
// 4. Usage-Based Pricing
// ══════════════════════════════════════════════════════════════════

export type UsageMetric =
  | 'active_employees'
  | 'esocial_events_sent'
  | 'documents_signed'
  | 'storage_mb'
  | 'api_calls'
  | 'ai_queries'
  | 'payroll_simulations';

export interface UsageTier {
  from: number;
  to: number | null; // null = unlimited
  unit_price_brl: number;
}

export interface UsagePricingRule {
  id: string;
  metric: UsageMetric;
  label: string;
  description: string;
  /** Included quantity in the base plan (free tier) */
  included_quantity: number;
  /** Pricing tiers for overage */
  tiers: UsageTier[];
  /** Billing granularity */
  billing_granularity: 'monthly' | 'daily';
  /** Plan tiers this rule applies to */
  applies_to_tiers: PlanTier[];
  is_active: boolean;
}

export interface UsageRecord {
  id: string;
  tenant_id: string;
  metric: UsageMetric;
  quantity: number;
  period_start: number;
  period_end: number;
  recorded_at: number;
}

export interface UsageSummary {
  tenant_id: string;
  period_start: number;
  period_end: number;
  metrics: {
    metric: UsageMetric;
    label: string;
    included: number;
    used: number;
    overage: number;
    overage_cost_brl: number;
  }[];
  total_overage_brl: number;
}

export interface UsageBasedPricingPort {
  /** Record a usage event */
  record(tenantId: string, metric: UsageMetric, quantity: number): Promise<void>;
  /** Get current usage for a period */
  getCurrentUsage(tenantId: string, metric: UsageMetric): Promise<UsageRecord>;
  /** Get full usage summary for billing */
  getSummary(tenantId: string, periodStart: number, periodEnd: number): Promise<UsageSummary>;
  /** Check if tenant is within free tier */
  isWithinFreeTier(tenantId: string, metric: UsageMetric): Promise<boolean>;
  /** Get pricing rules for a plan */
  getRules(planTier: PlanTier): Promise<UsagePricingRule[]>;
  /** Estimate cost for projected usage */
  estimateCost(tenantId: string, projections: { metric: UsageMetric; quantity: number }[]): Promise<number>;
}

// ══════════════════════════════════════════════════════════════════
// Aggregate: Billing Domain API
// ══════════════════════════════════════════════════════════════════

export interface BillingDomainAPI {
  gateway: BillingGatewayPort;
  marketplace: ModuleMarketplacePort;
  addons: PlanAddonPort;
  usage: UsageBasedPricingPort;
}
