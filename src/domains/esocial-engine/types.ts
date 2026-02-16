/**
 * eSocial Integration Engine — Type Definitions
 *
 * Domain types for the eSocial bounded context.
 * Decoupled from HR Core — communicates via domain events only.
 *
 * Layout versioning: each event type carries a `layout_version` field
 * allowing gradual migration (e.g. S-1.1 → S-1.2).
 */

// ════════════════════════════════════
// LAYOUT VERSIONING
// ════════════════════════════════════

export type LayoutVersion = 'S-1.0' | 'S-1.1' | 'S-1.2';

export const CURRENT_LAYOUT_VERSION: LayoutVersion = 'S-1.2';

// ════════════════════════════════════
// EVENT LIFECYCLE
// ════════════════════════════════════

export type TransmissionStatus =
  | 'draft'       // Created but not validated
  | 'validated'   // Passed schema validation
  | 'queued'      // Ready to send
  | 'transmitting'// In-flight to government
  | 'accepted'    // Government accepted (has receipt)
  | 'rejected'    // Government rejected (has error)
  | 'error'       // Technical/network error
  | 'cancelled';  // Manually cancelled

export type ESocialCategory =
  | 'tabelas'
  | 'nao_periodicos'
  | 'periodicos'
  | 'sst'
  | 'gfip_fgts';

// ════════════════════════════════════
// EVENT TYPE REGISTRY
// ════════════════════════════════════

export interface ESocialEventType {
  code: string;           // e.g. 'S-1000'
  name: string;           // e.g. 'Informações do Empregador'
  category: ESocialCategory;
  layout_version: LayoutVersion;
  /** XSD schema identifier for validation */
  schema_id: string;
}

export const EVENT_TYPE_REGISTRY: Record<string, ESocialEventType> = {
  'S-1000': { code: 'S-1000', name: 'Informações do Empregador/Contribuinte', category: 'tabelas', layout_version: 'S-1.2', schema_id: 'evtInfoEmpregador' },
  'S-1010': { code: 'S-1010', name: 'Tabela de Rubricas', category: 'tabelas', layout_version: 'S-1.2', schema_id: 'evtTabRubrica' },
  'S-1030': { code: 'S-1030', name: 'Tabela de Cargos/Empregos Públicos', category: 'tabelas', layout_version: 'S-1.2', schema_id: 'evtTabCargo' },
  'S-2200': { code: 'S-2200', name: 'Cadastramento Inicial / Admissão', category: 'nao_periodicos', layout_version: 'S-1.2', schema_id: 'evtAdmissao' },
  'S-2205': { code: 'S-2205', name: 'Alteração de Dados Cadastrais', category: 'nao_periodicos', layout_version: 'S-1.2', schema_id: 'evtAltCadastral' },
  'S-2206': { code: 'S-2206', name: 'Alteração de Contrato de Trabalho', category: 'nao_periodicos', layout_version: 'S-1.2', schema_id: 'evtAltContratual' },
  'S-2230': { code: 'S-2230', name: 'Afastamento Temporário', category: 'nao_periodicos', layout_version: 'S-1.2', schema_id: 'evtAfastTemp' },
  'S-2299': { code: 'S-2299', name: 'Desligamento', category: 'nao_periodicos', layout_version: 'S-1.2', schema_id: 'evtDeslig' },
  'S-1200': { code: 'S-1200', name: 'Remuneração do Trabalhador', category: 'periodicos', layout_version: 'S-1.2', schema_id: 'evtRemun' },
  'S-1210': { code: 'S-1210', name: 'Pagamentos de Rendimentos', category: 'periodicos', layout_version: 'S-1.2', schema_id: 'evtPgtos' },
  'S-1299': { code: 'S-1299', name: 'Fechamento Eventos Periódicos', category: 'periodicos', layout_version: 'S-1.2', schema_id: 'evtFechaEvPer' },
  'S-2210': { code: 'S-2210', name: 'CAT - Comunicação de Acidente', category: 'sst', layout_version: 'S-1.2', schema_id: 'evtCAT' },
  'S-2220': { code: 'S-2220', name: 'ASO - Monitoramento da Saúde', category: 'sst', layout_version: 'S-1.2', schema_id: 'evtMonit' },
  'S-2240': { code: 'S-2240', name: 'Condições Ambientais - Agentes Nocivos', category: 'sst', layout_version: 'S-1.2', schema_id: 'evtExpRisco' },
  'GFIP':   { code: 'GFIP', name: 'GFIP/FGTS Digital', category: 'gfip_fgts', layout_version: 'S-1.2', schema_id: 'gfipDigital' },
};

// ════════════════════════════════════
// TRANSMISSION ENVELOPE
// ════════════════════════════════════

/** A fully-built eSocial event ready for transmission */
export interface ESocialEnvelope {
  id: string;
  tenant_id: string;
  company_id: string | null;
  event_type: string;
  category: ESocialCategory;
  layout_version: LayoutVersion;

  /** The mapped payload in eSocial XML-equivalent JSON structure */
  payload: Record<string, unknown>;

  /** Source entity that triggered this event */
  source_entity_type: string;
  source_entity_id: string;

  /** Lifecycle */
  status: TransmissionStatus;
  receipt_number: string | null;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;

  /** Government response */
  response_payload: Record<string, unknown> | null;

  /** Timestamps */
  validated_at: string | null;
  queued_at: string | null;
  transmitted_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

// ════════════════════════════════════
// DOMAIN EVENTS (inbound from other BCs)
// ════════════════════════════════════

export type InboundEventName =
  | 'employee.hired'
  | 'employee.updated'
  | 'employee.terminated'
  | 'employee.leave_started'
  | 'salary.contract_started'
  | 'salary.adjusted'
  | 'health_exam.created'
  | 'risk_exposure.created'
  | 'company.created'
  | 'position.created'
  | 'rubric.created';

export interface InboundDomainEvent<T = Record<string, unknown>> {
  event_name: InboundEventName;
  tenant_id: string;
  company_id: string | null;
  entity_type: string;
  entity_id: string;
  payload: T;
  occurred_at: string;
}

// ════════════════════════════════════
// LAYOUT MAPPER CONTRACT (Port)
// ════════════════════════════════════

/** Each event type implements this interface to map internal data → eSocial layout */
export interface LayoutMapper<TInput = Record<string, unknown>> {
  event_type: string;
  layout_version: LayoutVersion;
  /** Map internal domain data to eSocial payload structure */
  map(input: TInput): Record<string, unknown>;
  /** Validate the mapped payload against schema rules */
  validate(payload: Record<string, unknown>): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ════════════════════════════════════
// TRANSMISSION RESULT
// ════════════════════════════════════

export interface TransmissionResult {
  envelope_id: string;
  success: boolean;
  receipt_number?: string;
  error_code?: string;
  error_message?: string;
  government_response?: Record<string, unknown>;
}

// ════════════════════════════════════
// DASHBOARD VIEW MODELS
// ════════════════════════════════════

export interface ESocialDashboardStats {
  total_events: number;
  by_status: Record<TransmissionStatus, number>;
  by_category: Record<ESocialCategory, number>;
  pending_count: number;
  error_count: number;
  accepted_rate: number;
  last_transmission_at: string | null;
}
