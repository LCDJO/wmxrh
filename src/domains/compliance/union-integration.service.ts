/**
 * Union Integration Service — Preparação Futura
 *
 * Integração com sindicatos para:
 * - Troca de dados de contribuição sindical
 * - Recebimento de tabelas de convenção coletiva atualizadas
 * - Envio de relação de empregados sindicalizados
 * - Recebimento de comunicados e pautas de negociação
 *
 * Providers planejados: API sindicato (quando disponível), importação manual CSV/XML.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type UnionDataExchangeFormat = 'xml' | 'csv' | 'json' | 'api';

export type UnionContributionType =
  | 'contribuicao_sindical'
  | 'contribuicao_assistencial'
  | 'contribuicao_confederativa'
  | 'mensalidade_sindical';

export interface UnionIntegrationConfig {
  tenant_id: string;
  company_id: string;
  union_cnpj: string;
  union_name: string;
  exchange_format: UnionDataExchangeFormat;
  api_url: string | null;
  enabled: boolean;
  auto_sync: boolean;
  collective_agreement_id: string | null;
}

export interface UnionContributionRecord {
  employee_id: string;
  employee_cpf: string;
  employee_name: string;
  contribution_type: UnionContributionType;
  competencia: string; // YYYY-MM
  valor: number;
  data_desconto: string;
  autorizado: boolean;
}

export interface UnionEmployeeReport {
  tenant_id: string;
  company_id: string;
  company_cnpj: string;
  union_cnpj: string;
  competencia: string;
  total_employees: number;
  total_unionized: number;
  employees: Array<{
    cpf: string;
    nome: string;
    data_admissao: string;
    cargo_cbo: string;
    salario_base: number;
    sindicalizado: boolean;
    contribuicao_mensal: number;
  }>;
}

export interface UnionSyncResult {
  success: boolean;
  records_sent: number;
  records_received: number;
  errors: string[];
  agreement_updates: Array<{
    field: string;
    old_value: string;
    new_value: string;
  }>;
}

// ═══════════════════════════════════════════════════════
// SERVICE STUB
// ═══════════════════════════════════════════════════════

export const unionIntegrationService = {
  /**
   * Export employee contribution data to union.
   * @todo Implement when union API specs are finalized.
   */
  async exportContributions(
    _config: UnionIntegrationConfig,
    _competencia: string,
  ): Promise<UnionSyncResult> {
    throw new Error('[UnionIntegration] Not implemented — awaiting union API specification.');
  },

  /**
   * Import updated collective agreement terms from union.
   * @todo Implement when union API specs are finalized.
   */
  async importAgreementUpdates(
    _config: UnionIntegrationConfig,
  ): Promise<UnionSyncResult> {
    throw new Error('[UnionIntegration] Not implemented — awaiting union API specification.');
  },

  /**
   * Generate employee report for union submission.
   */
  async generateEmployeeReport(
    _tenantId: string,
    _companyId: string,
    _competencia: string,
  ): Promise<UnionEmployeeReport> {
    throw new Error('[UnionIntegration] Not implemented — awaiting employee data completeness.');
  },

  /**
   * Validate union integration configuration.
   */
  validateConfig(config: Partial<UnionIntegrationConfig>): { valid: boolean; missing: string[] } {
    const required: (keyof UnionIntegrationConfig)[] = [
      'tenant_id', 'company_id', 'union_cnpj', 'union_name', 'exchange_format',
    ];
    const missing = required.filter((f) => !config[f]);
    return { valid: missing.length === 0, missing };
  },
};
