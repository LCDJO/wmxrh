/**
 * Billing Service Registry — Future
 *
 * Central registry for plugging in billing gateway adapters.
 * Allows hot-swapping between Stripe, Pagar.me, or manual billing.
 *
 * Usage (future):
 *   billingRegistry.registerGateway('stripe', new StripeAdapter(config));
 *   const gw = billingRegistry.getGateway();
 */

import type {
  BillingProvider,
  BillingGatewayPort,
  ModuleMarketplacePort,
  PlanAddonPort,
  UsageBasedPricingPort,
  BillingGatewayConfig,
} from './billing-future.types';

// ── Null adapters (safe defaults before real gateways) ───────────

const NULL_GATEWAY: BillingGatewayPort = {
  provider: 'manual' as BillingProvider,
  createCustomer: async () => { throw new Error('Billing gateway not configured'); },
  getCustomer: async () => null,
  updateCustomer: async () => { throw new Error('Billing gateway not configured'); },
  createSubscription: async () => { throw new Error('Billing gateway not configured'); },
  getSubscription: async () => null,
  updateSubscription: async () => { throw new Error('Billing gateway not configured'); },
  cancelSubscription: async () => { throw new Error('Billing gateway not configured'); },
  pauseSubscription: async () => { throw new Error('Billing gateway not configured'); },
  resumeSubscription: async () => { throw new Error('Billing gateway not configured'); },
  listInvoices: async () => [],
  getInvoice: async () => null,
  createCheckoutSession: async () => { throw new Error('Billing gateway not configured'); },
  createPortalSession: async () => { throw new Error('Billing gateway not configured'); },
  handleWebhook: async () => ({ event_type: 'unknown', tenant_id: null, processed: false }),
};

// ── Registry ─────────────────────────────────────────────────────

class BillingServiceRegistry {
  private gateway: BillingGatewayPort = NULL_GATEWAY;
  private marketplace: ModuleMarketplacePort | null = null;
  private addons: PlanAddonPort | null = null;
  private usage: UsageBasedPricingPort | null = null;
  private config: BillingGatewayConfig | null = null;

  /** Register the primary billing gateway adapter */
  registerGateway(config: BillingGatewayConfig, adapter: BillingGatewayPort) {
    this.config = config;
    this.gateway = adapter;
    console.info(`[BillingRegistry] Gateway registered: ${config.provider} (${config.environment})`);
  }

  registerMarketplace(adapter: ModuleMarketplacePort) {
    this.marketplace = adapter;
  }

  registerAddons(adapter: PlanAddonPort) {
    this.addons = adapter;
  }

  registerUsage(adapter: UsageBasedPricingPort) {
    this.usage = adapter;
  }

  getGateway(): BillingGatewayPort { return this.gateway; }
  getMarketplace(): ModuleMarketplacePort | null { return this.marketplace; }
  getAddons(): PlanAddonPort | null { return this.addons; }
  getUsage(): UsageBasedPricingPort | null { return this.usage; }
  getConfig(): BillingGatewayConfig | null { return this.config; }

  /** Check if a real gateway is configured */
  isConfigured(): boolean {
    return this.config !== null && this.config.enabled;
  }

  /** Check which provider is active */
  activeProvider(): BillingProvider | null {
    return this.config?.enabled ? this.config.provider : null;
  }
}

/** Singleton registry */
export const billingRegistry = new BillingServiceRegistry();
