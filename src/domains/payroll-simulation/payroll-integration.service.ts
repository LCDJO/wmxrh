/**
 * Payroll Integration Service — Preparação Futura
 *
 * Stubs para integração com sistemas de folha de pagamento oficial.
 * Quando conectado, este módulo exportará eventos de folha fechada
 * e receberá retornos de processamento.
 *
 * Providers planejados: Totvs Protheus, Senior, ADP, SAP HCM, Domínio.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type PayrollProvider = 'totvs_protheus' | 'senior' | 'adp' | 'sap_hcm' | 'dominio' | 'custom';

export type PayrollSyncDirection = 'push' | 'pull' | 'bidirectional';

export type PayrollSyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'partial';

export interface PayrollIntegrationConfig {
  provider: PayrollProvider;
  direction: PayrollSyncDirection;
  api_url: string;
  auth_type: 'api_key' | 'oauth2' | 'basic' | 'certificate';
  tenant_id: string;
  company_id: string;
  enabled: boolean;
  sync_schedule_cron: string | null;
  field_mapping: Record<string, string>;
  last_sync_at: string | null;
  last_sync_status: PayrollSyncStatus;
}

export interface PayrollExportPayload {
  competencia: string; // YYYY-MM
  tenant_id: string;
  company_id: string;
  employees: PayrollEmployeeData[];
  rubricas: PayrollRubrica[];
  totals: PayrollTotals;
  generated_at: string;
}

export interface PayrollEmployeeData {
  employee_id: string;
  matricula: string;
  cpf: string;
  name: string;
  admission_date: string;
  position_cbo: string;
  department_code: string;
  salary_base: number;
  events: PayrollEvent[];
}

export interface PayrollEvent {
  rubrica_code: string;
  description: string;
  type: 'provento' | 'desconto' | 'informativo';
  reference: number;
  value: number;
}

export interface PayrollRubrica {
  code: string;
  description: string;
  type: 'provento' | 'desconto' | 'informativo';
  incidences: {
    inss: boolean;
    irrf: boolean;
    fgts: boolean;
  };
}

export interface PayrollTotals {
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  total_encargos_patronais: number;
  total_fgts: number;
}

// ═══════════════════════════════════════════════════════
// SERVICE STUB
// ═══════════════════════════════════════════════════════

export const payrollIntegrationService = {
  /**
   * Export payroll data for a given competency period.
   * @todo Implement when provider connectors are ready.
   */
  async exportPayroll(_config: PayrollIntegrationConfig, _competencia: string): Promise<PayrollExportPayload> {
    throw new Error('[PayrollIntegration] Not implemented — awaiting provider connector setup.');
  },

  /**
   * Import payroll processing results from external system.
   * @todo Implement when provider connectors are ready.
   */
  async importPayrollResult(_config: PayrollIntegrationConfig, _competencia: string): Promise<void> {
    throw new Error('[PayrollIntegration] Not implemented — awaiting provider connector setup.');
  },

  /**
   * Validate field mapping between internal schema and provider schema.
   */
  validateFieldMapping(mapping: Record<string, string>): { valid: boolean; missing: string[] } {
    const requiredFields = ['cpf', 'name', 'admission_date', 'position_cbo', 'salary_base', 'department_code'];
    const missing = requiredFields.filter((f) => !mapping[f]);
    return { valid: missing.length === 0, missing };
  },

  /**
   * Test connectivity with provider endpoint.
   * @todo Implement per-provider health check.
   */
  async testConnection(_config: PayrollIntegrationConfig): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: 'Provider connector not configured yet.' };
  },
};
