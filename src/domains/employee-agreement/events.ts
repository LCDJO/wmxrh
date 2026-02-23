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
  | 'agreement.renewal_required'
  | 'agreement.auto_dispatch_triggered'
  // Governance Engine events
  | 'agreement.governance.dispatch_triggered'
  | 'agreement.governance.compliance_gate_checked'
  | 'agreement.governance.compliance_blocked'
  | 'agreement.governance.all_mandatory_signed'
  // Cross-engine integration events
  | 'agreement.integration.epi_term_dispatched'
  | 'agreement.integration.fleet_term_dispatched'
  | 'agreement.integration.nr_training_term_dispatched'
  | 'agreement.integration.career_term_dispatched';

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

export const __DOMAIN_CATALOG = {
  domain: 'Agreements',
  color: 'hsl(40 65% 48%)',
  events: [
    { name: 'agreement.template.created', description: 'Template de acordo criado' },
    { name: 'agreement.template.updated', description: 'Template de acordo atualizado' },
    { name: 'agreement.template.version_published', description: 'Versão de template publicada' },
    { name: 'agreement.sent_for_signature', description: 'Acordo enviado para assinatura' },
    { name: 'agreement.signed', description: 'Acordo assinado' },
    { name: 'agreement.rejected', description: 'Acordo rejeitado' },
    { name: 'agreement.expired', description: 'Acordo expirado' },
    { name: 'agreement.renewal_required', description: 'Renovação de acordo obrigatória' },
    { name: 'agreement.auto_dispatch_triggered', description: 'Envio automático de acordo acionado' },
    { name: 'agreement.governance.dispatch_triggered', description: 'Governance engine disparou termos' },
    { name: 'agreement.governance.compliance_gate_checked', description: 'Compliance gate verificado' },
    { name: 'agreement.governance.compliance_blocked', description: 'Ativação bloqueada por termos pendentes' },
    { name: 'agreement.governance.all_mandatory_signed', description: 'Todos os termos obrigatórios assinados' },
    { name: 'agreement.integration.epi_term_dispatched', description: 'Termo de EPI disparado' },
    { name: 'agreement.integration.fleet_term_dispatched', description: 'Termo veicular disparado' },
    { name: 'agreement.integration.nr_training_term_dispatched', description: 'Termo de treinamento NR disparado' },
    { name: 'agreement.integration.career_term_dispatched', description: 'Termo de cargo disparado' },
  ],
};
