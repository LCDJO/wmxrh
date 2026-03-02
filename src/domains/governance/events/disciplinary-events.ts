/**
 * GovernanceCoreEngine — Disciplinary Event Types
 *
 * Typed event payloads for the four core disciplinary actions:
 *   - Advertência (warning)
 *   - Suspensão (suspension)
 *   - Afastamento (leave/removal)
 *   - Desligamento (termination)
 *
 * All events are append-only and flow through the GovernanceEventStore.
 */

// ════════════════════════════════════
// EVENT TYPE CONSTANTS
// ════════════════════════════════════

export const DISCIPLINARY_EVENTS = {
  // Advertência
  AdvertenciaVerbalAplicada: 'AdvertenciaVerbalAplicada',
  AdvertenciaEscritaAplicada: 'AdvertenciaEscritaAplicada',
  AdvertenciaContestada: 'AdvertenciaContestada',
  AdvertenciaRevogada: 'AdvertenciaRevogada',

  // Suspensão
  SuspensaoAplicada: 'SuspensaoAplicada',
  SuspensaoIniciada: 'SuspensaoIniciada',
  SuspensaoEncerrada: 'SuspensaoEncerrada',
  SuspensaoContestada: 'SuspensaoContestada',
  SuspensaoRevogada: 'SuspensaoRevogada',

  // Afastamento
  AfastamentoSolicitado: 'AfastamentoSolicitado',
  AfastamentoAprovado: 'AfastamentoAprovado',
  AfastamentoIniciado: 'AfastamentoIniciado',
  AfastamentoProrrogado: 'AfastamentoProrrogado',
  AfastamentoEncerrado: 'AfastamentoEncerrado',
  RetornoRegistrado: 'RetornoRegistrado',

  // Desligamento
  DesligamentoSolicitado: 'DesligamentoSolicitado',
  DesligamentoAprovado: 'DesligamentoAprovado',
  DesligamentoExecutado: 'DesligamentoExecutado',
  RescisaoCalculada: 'RescisaoCalculada',
  HomologacaoRealizada: 'HomologacaoRealizada',

  // Cross-cutting
  RiskAssessmentCreated: 'RiskAssessmentCreated',
  AdministrativeDecisionCreated: 'AdministrativeDecisionCreated',
  AdministrativeDecisionApproved: 'AdministrativeDecisionApproved',
  AdministrativeDecisionRejected: 'AdministrativeDecisionRejected',
  AdministrativeDecisionExecuted: 'AdministrativeDecisionExecuted',
} as const;

export type DisciplinaryEventType = typeof DISCIPLINARY_EVENTS[keyof typeof DISCIPLINARY_EVENTS];

// ════════════════════════════════════
// PAYLOAD TYPES
// ════════════════════════════════════

export interface AdvertenciaPayload {
  employee_id: string;
  tipo: 'verbal' | 'escrita';
  motivo: string;
  base_legal: string | null;
  data_ocorrencia: string;
  testemunhas: string[];
  anexos: string[];
  observacoes: string | null;
}

export interface SuspensaoPayload {
  employee_id: string;
  motivo: string;
  base_legal: string | null;
  data_inicio: string;
  data_fim: string;
  duracao_dias: number;
  com_remuneracao: boolean;
  testemunhas: string[];
  anexos: string[];
}

export interface AfastamentoPayload {
  employee_id: string;
  tipo: 'medico' | 'maternidade' | 'paternidade' | 'acidente_trabalho' | 'servico_militar' | 'mandato_sindical' | 'outro';
  motivo: string;
  base_legal: string | null;
  data_inicio: string;
  data_fim_prevista: string | null;
  cid_codigo: string | null;
  inss_requerido: boolean;
  documento_referencia: string | null;
  anexos: string[];
}

export interface DesligamentoPayload {
  employee_id: string;
  tipo: 'sem_justa_causa' | 'com_justa_causa' | 'pedido_demissao' | 'acordo_mutuo' | 'termino_contrato' | 'falecimento' | 'aposentadoria';
  motivo: string;
  base_legal: string | null;
  data_aviso: string | null;
  data_desligamento: string;
  aviso_previo_cumprido: boolean;
  aviso_previo_indenizado: boolean;
  sancoes_relacionadas: string[];
  observacoes: string | null;
}

export interface RiskAssessmentPayload {
  employee_id: string;
  category: string;
  risk_score: number;
  risk_level: string;
  contributing_factors: Array<{ factor: string; weight: number; value: number; description: string }>;
  recommendation: string | null;
}

export interface AdministrativeDecisionPayload {
  employee_id: string;
  decision_type: string;
  justification: string;
  legal_basis: string | null;
  risk_assessment_id: string | null;
  related_sanction_ids: string[];
  effective_date: string;
}
