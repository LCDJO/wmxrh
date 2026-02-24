/**
 * Union Homologation Integration — Preparação Futura
 *
 * Integração com sindicatos para homologação de rescisões.
 * Obrigatória para contratos com mais de 1 ano (pré-Reforma Trabalhista)
 * e ainda exigida por muitas convenções coletivas.
 *
 * Fluxo planejado:
 *  1. Verificar exigência de homologação sindical (CCT)
 *  2. Agendar data/hora com sindicato
 *  3. Gerar documentação exigida (TRCT, extrato FGTS, etc.)
 *  4. Enviar eletronicamente ao sindicato (quando API disponível)
 *  5. Receber retorno de aprovação/ressalvas
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type HomologationStatus =
  | 'pending_schedule'
  | 'scheduled'
  | 'documents_sent'
  | 'in_review'
  | 'approved'
  | 'approved_with_reservations'
  | 'rejected'
  | 'cancelled';

export type HomologationChannel = 'presencial' | 'online' | 'api';

export interface HomologationRequirement {
  required: boolean;
  source: 'clt' | 'cct' | 'act' | 'company_policy';
  reference: string;
  min_contract_months: number | null;
  description: string;
}

export interface HomologationSchedule {
  id: string;
  workflow_id: string;
  tenant_id: string;
  employee_id: string;
  union_cnpj: string;
  union_name: string;
  channel: HomologationChannel;
  scheduled_date: string;
  scheduled_time: string;
  location: string | null;
  online_link: string | null;
  status: HomologationStatus;
  documents_required: string[];
  documents_submitted: string[];
  reservation_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomologationResult {
  success: boolean;
  status: HomologationStatus;
  protocol: string | null;
  reservations: string[];
  errors: string[];
}

// ═══════════════════════════════════════════════════════
// SERVICE STUB
// ═══════════════════════════════════════════════════════

export const unionHomologationService = {
  /**
   * Check if union homologation is required for this termination.
   */
  checkRequirement(
    _tenantId: string,
    _employeeId: string,
    _collectiveAgreementId: string | null,
  ): HomologationRequirement {
    return {
      required: false,
      source: 'cct',
      reference: '',
      min_contract_months: null,
      description: 'Verificação pendente — aguardando integração com base de CCTs.',
    };
  },

  /**
   * Schedule homologation with union.
   * @todo Implement when union scheduling API is available.
   */
  async schedule(
    _tenantId: string,
    _workflowId: string,
    _employeeId: string,
    _unionCnpj: string,
  ): Promise<HomologationSchedule> {
    throw new Error('[UnionHomologation] Not implemented — awaiting union scheduling API.');
  },

  /**
   * Submit documents for homologation review.
   * @todo Implement when union document API is available.
   */
  async submitDocuments(
    _scheduleId: string,
    _documentIds: string[],
  ): Promise<HomologationResult> {
    throw new Error('[UnionHomologation] Not implemented — awaiting union document API.');
  },

  /**
   * Check homologation status.
   */
  async getStatus(_scheduleId: string): Promise<HomologationSchedule | null> {
    return null;
  },

  /**
   * Get required documents for homologation.
   */
  getRequiredDocuments(_terminationType: string): string[] {
    return [
      'TRCT - Termo de Rescisão',
      'Extrato FGTS analítico',
      'Guia de recolhimento rescisório FGTS',
      'Comunicação de dispensa (CD)',
      'Atestado de Saúde Ocupacional demissional',
      'Comprovante de aviso prévio',
      'Últimas 6 folhas de pagamento',
    ];
  },
};
