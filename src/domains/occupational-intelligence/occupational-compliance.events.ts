/**
 * Occupational Compliance Domain Events
 *
 * Events emitted during the company onboarding compliance pipeline.
 */

export interface CompanyRiskProfileGeneratedEvent {
  type: 'CompanyRiskProfileGenerated';
  timestamp: string;
  payload: {
    tenant_id: string;
    company_id: string;
    cnae_codigo: string;
    grau_risco: number;
    ambiente: string;
    nrs_aplicaveis: number[];
    agentes_risco: string[];
  };
}

export interface CBOSuggestionsGeneratedEvent {
  type: 'CBOSuggestionsGenerated';
  timestamp: string;
  payload: {
    tenant_id: string;
    company_id: string;
    cnae_codigo: string;
    suggestions_count: number;
    cbo_codes: string[];
  };
}

export interface TrainingRequirementCreatedEvent {
  type: 'TrainingRequirementCreated';
  timestamp: string;
  payload: {
    tenant_id: string;
    company_id: string;
    cbo_codigo: string;
    nr_codigo: number;
    catalog_item_id: string;
    obrigatorio: boolean;
  };
}

export type OccupationalComplianceEvent =
  | CompanyRiskProfileGeneratedEvent
  | CBOSuggestionsGeneratedEvent
  | TrainingRequirementCreatedEvent;

// ─── In-memory event bus (lightweight, sync) ───

type EventHandler = (event: OccupationalComplianceEvent) => void;

const handlers: EventHandler[] = [];

export const occupationalEvents = {
  subscribe(handler: EventHandler) {
    handlers.push(handler);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  },

  emit(event: OccupationalComplianceEvent) {
    console.log(`[OccupationalEvent] ${event.type}`, event.payload);
    handlers.forEach(h => {
      try { h(event); } catch (e) { console.error('[OccupationalEvent] handler error:', e); }
    });
  },
};
