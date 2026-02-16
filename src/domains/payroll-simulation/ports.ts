/**
 * Payroll Simulation — Future Integration Ports
 *
 * Defines interface contracts (Hexagonal Architecture ports) that allow
 * the current simulation engine to evolve into:
 *
 *   1. Motor de Folha Oficial — official payroll generation
 *   2. Exportação eSocial — government-mandated reporting
 *   3. Integração Contábil — accounting system integration
 *
 * These are CONTRACTS ONLY — no implementation. Adapters will be
 * provided when each capability is activated.
 *
 * Design decisions:
 * - Ports are engine-agnostic: any future payroll provider can implement them
 * - eSocial port reuses existing event infrastructure (esocial_events table)
 * - Accounting port supports multi-format export (ECD, ECF, SPED)
 * - All ports require tenant_id for multi-tenant isolation
 * - All monetary outputs carry `is_oficial` flag to distinguish from simulation
 */

import type { PayrollSimulationOutput, SimulationInput } from './types';
import type { CalculatedRubric } from '@/domains/labor-rules';

// ══════════════════════════════════════════════════════════════
// 1. MOTOR DE FOLHA OFICIAL — Official Payroll Engine Port
// ══════════════════════════════════════════════════════════════

/**
 * Official payroll output — extends simulation with legal identifiers.
 * When `is_oficial` is true, values are legally binding.
 */
export interface OfficialPayrollOutput extends PayrollSimulationOutput {
  /** Distinguishes from simulation: true = folha oficial, false = simulação */
  is_oficial: true;
  /** Sequential payroll number (competência) */
  competencia: string;
  /** Payroll batch ID for audit trail */
  batch_id: string;
  /** Employee contract reference */
  contract_id: string;
  /** Official rubric codes (eSocial-compatible) */
  rubrics_oficiais: OfficialRubric[];
  /** Digital signature / hash for integrity */
  hash_verificacao: string;
  /** Approval workflow state */
  approval_status: 'draft' | 'pending_approval' | 'approved' | 'closed';
  approved_by?: string;
  approved_at?: string;
}

export interface OfficialRubric extends CalculatedRubric {
  /** eSocial rubric code (e.g., '1000' for salário base) */
  codigo_esocial: string;
  /** Incidence table code */
  tabela_incidencia: string;
  /** Official sequence in holerite */
  sequencia: number;
}

/**
 * Port: Official Payroll Engine
 *
 * Future adapters will implement this to generate legally-binding payroll.
 * The simulation engine provides the calculation backbone; this port adds
 * official sequencing, approval workflows, and legal compliance.
 */
export interface OfficialPayrollPort {
  /**
   * Generate official payroll for a single employee.
   * Uses the same SimulationInput but produces legally-binding output.
   */
  generatePayroll(
    tenantId: string,
    employeeId: string,
    contractId: string,
    competencia: string,
    input: SimulationInput,
  ): Promise<OfficialPayrollOutput>;

  /**
   * Process batch payroll for all active employees in a company.
   * Returns individual results + batch summary.
   */
  processBatch(
    tenantId: string,
    companyId: string,
    competencia: string,
  ): Promise<PayrollBatchResult>;

  /**
   * Close a competência — no more edits allowed after this.
   * Triggers eSocial events (S-1200, S-1210, S-1299).
   */
  closeCompetencia(
    tenantId: string,
    companyId: string,
    competencia: string,
    approvedBy: string,
  ): Promise<void>;

  /**
   * Reopen a closed competência for corrections (retificação).
   * Must generate rectification events.
   */
  reopenCompetencia(
    tenantId: string,
    companyId: string,
    competencia: string,
    reason: string,
  ): Promise<void>;
}

export interface PayrollBatchResult {
  batch_id: string;
  competencia: string;
  company_id: string;
  tenant_id: string;
  total_employees: number;
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  total_custo_empregador: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'closed';
  individual_results: OfficialPayrollOutput[];
  errors: PayrollProcessingError[];
  created_at: string;
}

export interface PayrollProcessingError {
  employee_id: string;
  error_code: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
}

// ══════════════════════════════════════════════════════════════
// 2. EXPORTAÇÃO eSocial — Government Reporting Port
// ══════════════════════════════════════════════════════════════

/**
 * eSocial payload — structured data for government submission.
 * Maps to existing esocial_events table structure.
 */
export interface ESocialPayrollPayload {
  /** S-1200: Remuneração do Trabalhador */
  event_type: 'S-1200' | 'S-1210' | 'S-1299' | 'S-2299';
  /** Employee CPF (masked in non-official contexts) */
  cpf_trabalhador: string;
  /** NIS / PIS */
  nis_trabalhador: string;
  /** Competência (YYYY-MM) */
  competencia: string;
  /** Category code (e.g., 101 = empregado geral) */
  categoria_trabalhador: number;
  /** Rubric items formatted for eSocial XML */
  itens_remuneracao: ESocialRubricItem[];
  /** Calculated bases */
  info_complementares: {
    base_inss: number;
    base_irrf: number;
    base_fgts: number;
    valor_inss_descontado: number;
    valor_irrf_descontado: number;
    valor_fgts_depositado: number;
  };
}

export interface ESocialRubricItem {
  /** eSocial rubric code */
  codigo_rubrica: string;
  /** Identifier in company's rubric table */
  id_tabela_rubrica: string;
  /** Quantity (hours, days, etc.) */
  quantidade?: number;
  /** Factor (percentage, multiplier) */
  fator?: number;
  /** Monetary value */
  valor: number;
  /** Incidence for INSS (00-99) */
  ind_apuracao_inss: string;
}

/**
 * Port: eSocial Export
 *
 * Future adapters will implement this to generate eSocial XML events
 * from official payroll data. Leverages existing esocial_events table.
 */
export interface ESocialExportPort {
  /**
   * Generate S-1200 (Remuneração) payload from official payroll.
   */
  buildS1200(
    tenantId: string,
    payroll: OfficialPayrollOutput,
    employeeData: ESocialEmployeeData,
  ): Promise<ESocialPayrollPayload>;

  /**
   * Generate S-1210 (Pagamentos) payload.
   */
  buildS1210(
    tenantId: string,
    payroll: OfficialPayrollOutput,
    paymentDate: string,
  ): Promise<ESocialPayrollPayload>;

  /**
   * Generate S-1299 (Fechamento Eventos Periódicos).
   */
  buildS1299(
    tenantId: string,
    companyId: string,
    competencia: string,
  ): Promise<ESocialPayrollPayload>;

  /**
   * Validate payload against eSocial XSD schemas.
   */
  validatePayload(payload: ESocialPayrollPayload): ESocialValidationResult;

  /**
   * Submit event to eSocial WebService (when integrated).
   * Stores result in esocial_events table.
   */
  submitEvent(
    tenantId: string,
    payload: ESocialPayrollPayload,
  ): Promise<ESocialSubmissionResult>;
}

export interface ESocialEmployeeData {
  cpf: string;
  nis: string;
  nome: string;
  categoria: number;
  matricula: string;
}

export interface ESocialValidationResult {
  is_valid: boolean;
  errors: { field: string; message: string; rule: string }[];
  warnings: { field: string; message: string }[];
}

export interface ESocialSubmissionResult {
  event_id: string;
  protocol: string;
  receipt_number?: string;
  status: 'accepted' | 'rejected' | 'processing';
  errors?: string[];
}

// ══════════════════════════════════════════════════════════════
// 3. INTEGRAÇÃO CONTÁBIL — Accounting Integration Port
// ══════════════════════════════════════════════════════════════

/**
 * Accounting entry — maps payroll to chart of accounts.
 * Follows Brazilian accounting standards (CPC / NBC).
 */
export interface AccountingEntry {
  /** Accounting date (usually last day of competência) */
  data_lancamento: string;
  /** Competência reference */
  competencia: string;
  /** Chart of accounts code (plano de contas) */
  conta_contabil: string;
  /** Account description */
  descricao_conta: string;
  /** Cost center */
  centro_custo: string;
  /** Debit amount */
  debito: number;
  /** Credit amount */
  credito: number;
  /** Historical description for the ledger */
  historico: string;
  /** Source document reference */
  documento_origem: string;
  /** Entry type */
  tipo: 'provisao' | 'apropriacao' | 'pagamento' | 'encargo';
}

/**
 * Port: Accounting Integration
 *
 * Future adapters will implement this to export payroll data
 * to ERP/accounting systems (TOTVS, SAP, Domínio, etc.).
 */
export interface AccountingIntegrationPort {
  /**
   * Generate accounting entries from official payroll batch.
   * Maps rubrics → chart of accounts based on configuration.
   */
  generateEntries(
    tenantId: string,
    batch: PayrollBatchResult,
    accountMapping: AccountMappingConfig,
  ): Promise<AccountingEntry[]>;

  /**
   * Export entries in SPED-compatible format.
   * Supports: ECD (Escrituração Contábil Digital), ECF, SPED Fiscal.
   */
  exportSPED(
    tenantId: string,
    entries: AccountingEntry[],
    format: 'ECD' | 'ECF' | 'SPED_FISCAL',
  ): Promise<SPEDExportResult>;

  /**
   * Export entries as CSV/XLSX for manual import into ERPs.
   */
  exportFlat(
    tenantId: string,
    entries: AccountingEntry[],
    format: 'csv' | 'xlsx',
  ): Promise<Blob>;

  /**
   * Push entries directly to integrated ERP via API.
   */
  pushToERP(
    tenantId: string,
    entries: AccountingEntry[],
    erpConfig: ERPConnectionConfig,
  ): Promise<ERPPushResult>;
}

export interface AccountMappingConfig {
  /** Maps rubric codes to chart of accounts */
  rubric_to_account: Record<string, {
    conta_debito: string;
    conta_credito: string;
    centro_custo_default: string;
  }>;
  /** Default accounts for unmapped rubrics */
  defaults: {
    salarios_debito: string;
    salarios_credito: string;
    encargos_debito: string;
    encargos_credito: string;
    provisoes_debito: string;
    provisoes_credito: string;
  };
}

export interface SPEDExportResult {
  file_content: string;
  filename: string;
  format: 'ECD' | 'ECF' | 'SPED_FISCAL';
  total_entries: number;
  total_debito: number;
  total_credito: number;
  validation_status: 'valid' | 'warnings' | 'errors';
  validation_messages: string[];
}

export interface ERPConnectionConfig {
  provider: 'totvs' | 'sap' | 'dominio' | 'senior' | 'custom';
  api_url: string;
  auth_method: 'bearer' | 'basic' | 'oauth2';
  /** Secret reference — never stored in plain text */
  credential_secret_ref: string;
}

export interface ERPPushResult {
  success: boolean;
  entries_sent: number;
  entries_accepted: number;
  entries_rejected: number;
  errors: { entry_index: number; message: string }[];
  erp_batch_id?: string;
}
