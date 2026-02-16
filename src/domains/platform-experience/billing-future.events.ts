/**
 * Billing Domain Events — Future
 *
 * Events emitted by the billing subsystem when external
 * gateways are connected.
 */

export type BillingDomainEventType =
  // Gateway
  | 'SubscriptionCreated'
  | 'SubscriptionUpdated'
  | 'SubscriptionCancelled'
  | 'SubscriptionPastDue'
  | 'PaymentSucceeded'
  | 'PaymentFailed'
  | 'InvoiceGenerated'
  | 'RefundIssued'
  // Marketplace
  | 'ModuleInstalled'
  | 'ModuleUninstalled'
  | 'ModuleLicenseExpired'
  // Add-ons
  | 'AddonSubscribed'
  | 'AddonCancelled'
  | 'AddonExpired'
  // Usage
  | 'UsageThresholdReached'
  | 'UsageOverageDetected'
  | 'UsageReportGenerated';

export interface BillingDomainEvent {
  type: BillingDomainEventType;
  tenant_id: string;
  timestamp: number;
  actor_id?: string;
  metadata: Record<string, unknown>;
}

/**
 * Future: Register billing event handlers.
 * Placeholder — will be wired to platform-events when gateways are active.
 */
export function createBillingEventBus() {
  type Handler = (event: BillingDomainEvent) => void;
  const handlers = new Map<BillingDomainEventType, Set<Handler>>();

  return {
    on(type: BillingDomainEventType, handler: Handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
      return () => handlers.get(type)?.delete(handler);
    },

    emit(event: BillingDomainEvent) {
      handlers.get(event.type)?.forEach(h => {
        try { h(event); } catch (e) { console.error('[BillingEvents]', e); }
      });
    },

    /** Convenience: emit with builder */
    dispatch(type: BillingDomainEventType, tenantId: string, metadata: Record<string, unknown> = {}) {
      this.emit({
        type,
        tenant_id: tenantId,
        timestamp: Date.now(),
        metadata,
      });
    },
  };
}
