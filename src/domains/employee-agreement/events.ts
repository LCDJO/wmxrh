/**
 * Employee Agreement Engine — Domain Events
 *
 * Events emitted by this bounded context for integration with:
 *   - HR Core (employee admission triggers)
 *   - Audit (legal trail)
 *   - Government Integration Gateway (eSocial if needed)
 */

export type AgreementEventType =
  | 'agreement.template.created'
  | 'agreement.template.updated'
  | 'agreement.template.version_published'
  | 'agreement.sent_for_signature'
  | 'agreement.signed'
  | 'agreement.rejected'
  | 'agreement.expired'
  | 'agreement.auto_dispatch_triggered';

export interface AgreementDomainEvent {
  type: AgreementEventType;
  tenant_id: string;
  company_id?: string;
  employee_id?: string;
  agreement_id?: string;
  template_id?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

type AgreementEventHandler = (event: AgreementDomainEvent) => void;

const handlers = new Map<AgreementEventType, AgreementEventHandler[]>();

export function onAgreementEvent(type: AgreementEventType, handler: AgreementEventHandler): void {
  const list = handlers.get(type) || [];
  list.push(handler);
  handlers.set(type, list);
}

export function emitAgreementEvent(event: AgreementDomainEvent): void {
  const list = handlers.get(event.type) || [];
  for (const handler of list) {
    try {
      handler(event);
    } catch (err) {
      console.error(`[AgreementEngine] Event handler error for ${event.type}:`, err);
    }
  }
}

export function resetAgreementHandlers(): void {
  handlers.clear();
}
