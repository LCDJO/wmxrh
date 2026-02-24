/**
 * Accounting Export Service — Preparação Futura
 *
 * Exportação de dados trabalhistas para sistemas contábeis.
 * Gera lançamentos contábeis padronizados a partir de eventos
 * de folha, rescisão, provisões e encargos.
 *
 * Formatos planejados: SPED Contábil (ECD), layout Domínio,
 * layout Totvs Protheus, CSV genérico, OFX.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type AccountingExportFormat =
  | 'sped_ecd'
  | 'dominio'
  | 'totvs_protheus'
  | 'csv_generic'
  | 'ofx';

export type AccountingEntryType =
  | 'folha_pagamento'
  | 'rescisao'
  | 'provisao_ferias'
  | 'provisao_13'
  | 'encargos_patronais'
  | 'beneficios'
  | 'fgts'
  | 'inss_patronal'
  | 'irrf';

export type DebitCreditType = 'D' | 'C';

export interface AccountingExportConfig {
  tenant_id: string;
  company_id: string;
  format: AccountingExportFormat;
  plano_contas_mapping: Record<string, string>; // rubrica → conta contábil
  centro_custo_mapping: Record<string, string>; // departamento → centro de custo
  historico_padrao: Record<AccountingEntryType, string>;
  competencia: string; // YYYY-MM
  include_analytics: boolean;
}

export interface AccountingEntry {
  date: string;
  entry_type: AccountingEntryType;
  account_code: string;
  account_name: string;
  cost_center: string | null;
  debit_credit: DebitCreditType;
  amount: number;
  history: string;
  document_ref: string | null;
  employee_cpf: string | null;
  rubrica_code: string | null;
}

export interface AccountingExportResult {
  success: boolean;
  format: AccountingExportFormat;
  filename: string;
  competencia: string;
  total_entries: number;
  total_debits: number;
  total_credits: number;
  balance_check: boolean; // débitos === créditos
  content: string;
  errors: string[];
  warnings: string[];
}

export interface AccountingPlanMapping {
  rubrica_code: string;
  rubrica_description: string;
  conta_debito: string;
  conta_credito: string;
  centro_custo_rule: 'by_department' | 'by_company' | 'fixed';
  centro_custo_fixed: string | null;
}

// ═══════════════════════════════════════════════════════
// SERVICE STUB
// ═══════════════════════════════════════════════════════

export const accountingExportService = {
  /**
   * Generate accounting entries for a given competency period.
   * @todo Implement when payroll closing data is available.
   */
  async generate(
    _config: AccountingExportConfig,
  ): Promise<AccountingExportResult> {
    throw new Error('[AccountingExport] Not implemented — awaiting payroll closing integration.');
  },

  /**
   * Generate rescission accounting entries for a specific workflow.
   * @todo Implement when rescission calculator provides final values.
   */
  async generateRescissionEntries(
    _config: AccountingExportConfig,
    _workflowId: string,
  ): Promise<AccountingEntry[]> {
    throw new Error('[AccountingExport] Not implemented — awaiting rescission data integration.');
  },

  /**
   * Validate account plan mapping completeness.
   */
  validateMapping(
    mappings: AccountingPlanMapping[],
    rubricaCodes: string[],
  ): { valid: boolean; unmapped: string[] } {
    const mappedCodes = new Set(mappings.map((m) => m.rubrica_code));
    const unmapped = rubricaCodes.filter((code) => !mappedCodes.has(code));
    return { valid: unmapped.length === 0, unmapped };
  },

  /**
   * Check if debits equal credits (balance validation).
   */
  validateBalance(entries: AccountingEntry[]): { balanced: boolean; difference: number } {
    const totals = entries.reduce(
      (acc, e) => {
        if (e.debit_credit === 'D') acc.debits += e.amount;
        else acc.credits += e.amount;
        return acc;
      },
      { debits: 0, credits: 0 },
    );
    const diff = Math.abs(totals.debits - totals.credits);
    return { balanced: diff < 0.01, difference: diff };
  },

  /**
   * Get supported export formats.
   */
  getSupportedFormats(): Array<{ id: AccountingExportFormat; label: string; description: string }> {
    return [
      { id: 'sped_ecd', label: 'SPED ECD', description: 'Escrituração Contábil Digital (Receita Federal)' },
      { id: 'dominio', label: 'Domínio Contábil', description: 'Layout Thomson Reuters / Domínio Sistemas' },
      { id: 'totvs_protheus', label: 'Totvs Protheus', description: 'Layout integração contábil Protheus' },
      { id: 'csv_generic', label: 'CSV Genérico', description: 'Formato CSV com mapeamento customizável' },
      { id: 'ofx', label: 'OFX', description: 'Open Financial Exchange' },
    ];
  },
};
