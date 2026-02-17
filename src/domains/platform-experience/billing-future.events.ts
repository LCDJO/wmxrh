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

export const __DOMAIN_CATALOG = {
  domain: 'Billing Marketplace',
  color: 'hsl(150 55% 40%)',
  events: [
    { name: 'SubscriptionCreated', description: 'Assinatura criada' },
    { name: 'SubscriptionUpdated', description: 'Assinatura atualizada' },
    { name: 'SubscriptionCancelled', description: 'Assinatura cancelada' },
    { name: 'SubscriptionPastDue', description: 'Assinatura em atraso' },
    { name: 'PaymentSucceeded', description: 'Pagamento bem-sucedido' },
    { name: 'PaymentFailed', description: 'Falha no pagamento' },
    { name: 'RefundIssued', description: 'Reembolso emitido' },
    { name: 'ModuleInstalled', description: 'Módulo instalado via marketplace' },
    { name: 'ModuleUninstalled', description: 'Módulo desinstalado' },
    { name: 'ModuleLicenseExpired', description: 'Licença de módulo expirada' },
    { name: 'AddonSubscribed', description: 'Add-on contratado' },
    { name: 'AddonCancelled', description: 'Add-on cancelado' },
    { name: 'AddonExpired', description: 'Add-on expirado' },
    { name: 'UsageThresholdReached', description: 'Limite de uso atingido' },
    { name: 'UsageOverageDetected', description: 'Excedente de uso detectado' },
    { name: 'UsageReportGenerated', description: 'Relatório de uso gerado' },
  ],
};
