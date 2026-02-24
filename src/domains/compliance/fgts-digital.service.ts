/**
 * FGTS Digital Integration — Preparação Futura
 *
 * Integração com o FGTS Digital (substituto da GRRF/SEFIP).
 * O FGTS Digital é o novo sistema do Governo Federal para recolhimento
 * e gestão do FGTS, integrado ao eSocial.
 *
 * Funcionalidades planejadas:
 *  1. Geração de guia rescisória via FGTS Digital
 *  2. Consulta de saldo FGTS do trabalhador
 *  3. Simulação de multa rescisória (40% ou 20%)
 *  4. Envio de recolhimento mensal
 *  5. Conciliação de valores eSocial × FGTS Digital
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type FGTSGuiaType =
  | 'mensal'
  | 'rescisoria'
  | 'recursal'
  | '13_salario'
  | 'complementar';

export type FGTSRecolhimentoStatus =
  | 'draft'
  | 'generated'
  | 'paid'
  | 'confirmed'
  | 'error'
  | 'cancelled';

export type FGTSTerminationType =
  | 'sem_justa_causa'       // Multa 40%
  | 'culpa_reciproca'       // Multa 20%
  | 'acordo_mutuo'          // Multa 20%
  | 'justa_causa'           // Sem multa, sem saque
  | 'pedido_demissao';      // Sem multa, sem saque

export interface FGTSDigitalConfig {
  tenant_id: string;
  company_id: string;
  company_cnpj: string;
  certificado_type: 'A1' | 'A3';
  certificado_valid_until: string;
  api_environment: 'sandbox' | 'production';
  enabled: boolean;
}

export interface FGTSGuiaRescisoria {
  id: string;
  tenant_id: string;
  employee_id: string;
  workflow_id: string | null;
  employee_cpf: string;
  employee_pis: string;
  termination_type: FGTSTerminationType;
  termination_date: string;
  saldo_fgts_estimado: number;
  multa_percentage: number;         // 0, 20 or 40
  multa_valor: number;
  deposito_mes_anterior: number;
  deposito_mes_rescisao: number;
  deposito_aviso_previo_indenizado: number;
  deposito_13_proporcional: number;
  total_guia: number;
  status: FGTSRecolhimentoStatus;
  guia_number: string | null;
  barcode: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface FGTSSaldoConsulta {
  employee_cpf: string;
  employee_pis: string;
  saldo_disponivel: number;
  saldo_bloqueado: number;
  ultimo_deposito_competencia: string;
  ultimo_deposito_valor: number;
  consulted_at: string;
}

export interface FGTSConciliacao {
  competencia: string;
  total_esocial: number;
  total_fgts_digital: number;
  diferenca: number;
  divergencias: Array<{
    employee_cpf: string;
    employee_name: string;
    valor_esocial: number;
    valor_fgts: number;
    diferenca: number;
  }>;
}

// ═══════════════════════════════════════════════════════
// SERVICE STUB
// ═══════════════════════════════════════════════════════

export const fgtsDigitalService = {
  /**
   * Generate FGTS rescission guide.
   * @todo Implement when FGTS Digital API credentials are configured.
   */
  async generateGuiaRescisoria(
    _config: FGTSDigitalConfig,
    _employeeId: string,
    _terminationType: FGTSTerminationType,
    _terminationDate: string,
  ): Promise<FGTSGuiaRescisoria> {
    throw new Error('[FGTSDigital] Not implemented — awaiting FGTS Digital API integration.');
  },

  /**
   * Query employee FGTS balance.
   * @todo Implement when FGTS Digital API is available.
   */
  async consultarSaldo(
    _config: FGTSDigitalConfig,
    _employeeCpf: string,
    _employeePis: string,
  ): Promise<FGTSSaldoConsulta> {
    throw new Error('[FGTSDigital] Not implemented — awaiting FGTS Digital API integration.');
  },

  /**
   * Reconcile eSocial vs FGTS Digital values for a given month.
   * @todo Implement when both eSocial and FGTS Digital data are available.
   */
  async conciliar(
    _config: FGTSDigitalConfig,
    _competencia: string,
  ): Promise<FGTSConciliacao> {
    throw new Error('[FGTSDigital] Not implemented — awaiting FGTS Digital API integration.');
  },

  /**
   * Calculate rescission penalty amount.
   */
  calculateMulta(
    saldoFgts: number,
    terminationType: FGTSTerminationType,
  ): { percentage: number; valor: number } {
    const percentageMap: Record<FGTSTerminationType, number> = {
      sem_justa_causa: 40,
      culpa_reciproca: 20,
      acordo_mutuo: 20,
      justa_causa: 0,
      pedido_demissao: 0,
    };
    const percentage = percentageMap[terminationType];
    return { percentage, valor: saldoFgts * (percentage / 100) };
  },

  /**
   * Validate FGTS Digital configuration.
   */
  validateConfig(config: Partial<FGTSDigitalConfig>): { valid: boolean; missing: string[] } {
    const required: (keyof FGTSDigitalConfig)[] = [
      'tenant_id', 'company_id', 'company_cnpj', 'certificado_type',
    ];
    const missing = required.filter((f) => !config[f]);
    return { valid: missing.length === 0, missing };
  },
};
