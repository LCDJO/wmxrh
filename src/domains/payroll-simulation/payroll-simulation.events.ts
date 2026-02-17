/**
 * Payroll Simulation — Domain Events
 *
 * Immutable event contracts emitted during simulation lifecycle.
 * Consumed by audit, notifications, and analytics subsystems.
 */

// ── Event Types ──

export type PayrollSimulationEventType =
  | 'PayrollSimulationCreated'
  | 'EncargoEstimateUpdated'
  | 'SimulationRiskDetected';

// ── Event Payloads ──

export interface PayrollSimulationCreatedPayload {
  simulation_id?: string;
  employee_id?: string;
  tenant_id: string;
  competencia?: string;
  salario_base: number;
  custo_total_empregador: number;
  fator_custo: number;
  is_adhoc: boolean;
}

export interface EncargoEstimateUpdatedPayload {
  tenant_id: string;
  employee_id?: string;
  base_inss: number;
  valor_inss_estimado: number;
  valor_irrf_estimado: number;
  valor_fgts_estimado: number;
  total_encargos_estimados: number;
  previous_total?: number;
  delta?: number;
}

export type SimulationRiskLevel = 'info' | 'warning' | 'critical';

export interface SimulationRiskDetectedPayload {
  tenant_id: string;
  employee_id?: string;
  risk_code: string;
  risk_level: SimulationRiskLevel;
  message: string;
  details?: Record<string, unknown>;
}

// ── Unified Event Envelope ──

export interface PayrollSimulationEvent<T = unknown> {
  type: PayrollSimulationEventType;
  payload: T;
  emitted_at: string;
  source: 'payroll_simulation_engine';
}

// ── Event Bus (in-memory, extensible) ──

type EventHandler = (event: PayrollSimulationEvent) => void;

const handlers: Map<PayrollSimulationEventType, EventHandler[]> = new Map();

export const payrollSimulationEventBus = {
  /**
   * Subscribe to a simulation event type.
   */
  on(type: PayrollSimulationEventType, handler: EventHandler): () => void {
    const list = handlers.get(type) ?? [];
    list.push(handler);
    handlers.set(type, list);
    return () => {
      const current = handlers.get(type) ?? [];
      handlers.set(type, current.filter(h => h !== handler));
    };
  },

  /**
   * Emit a domain event to all registered handlers.
   */
  emit<T>(type: PayrollSimulationEventType, payload: T): void {
    const event: PayrollSimulationEvent<T> = {
      type,
      payload,
      emitted_at: new Date().toISOString(),
      source: 'payroll_simulation_engine',
    };
    const list = handlers.get(type) ?? [];
    for (const handler of list) {
      try {
        handler(event as PayrollSimulationEvent);
      } catch (err) {
        console.error(`[PayrollSimulationEvent] Error in handler for ${type}:`, err);
      }
    }
  },

  /** Remove all handlers (useful for testing). */
  clear(): void {
    handlers.clear();
  },
};

// ── Risk Detection Helpers ──

const FATOR_CUSTO_WARNING = 2.0;
const FATOR_CUSTO_CRITICAL = 2.5;
const INSS_CEILING = 7786.02;
const MAX_HE_MENSAL = 44; // CLT Art. 59 — máximo 2h/dia × 22 dias úteis

export interface ComplianceContext {
  /** Piso salarial da CCT (se disponível) */
  piso_cct?: number;
  /** Funcionário tem vínculo de risco ativo (insalubridade/periculosidade) */
  tem_vinculo_risco?: boolean;
}

export function detectSimulationRisks(
  tenantId: string,
  employeeId: string | undefined,
  fatorCusto: number,
  baseInss: number,
  salarioBase: number,
  input?: { horas_extras_50?: number; horas_extras_100?: number; insalubridade_grau?: string | null; periculosidade?: boolean },
  compliance?: ComplianceContext,
): SimulationRiskDetectedPayload[] {
  const risks: SimulationRiskDetectedPayload[] = [];

  if (fatorCusto >= FATOR_CUSTO_CRITICAL) {
    risks.push({
      tenant_id: tenantId,
      employee_id: employeeId,
      risk_code: 'HIGH_COST_FACTOR',
      risk_level: 'critical',
      message: `Fator de custo ${fatorCusto.toFixed(2)}x excede limite crítico (${FATOR_CUSTO_CRITICAL}x)`,
      details: { fator_custo: fatorCusto, threshold: FATOR_CUSTO_CRITICAL },
    });
  } else if (fatorCusto >= FATOR_CUSTO_WARNING) {
    risks.push({
      tenant_id: tenantId,
      employee_id: employeeId,
      risk_code: 'HIGH_COST_FACTOR',
      risk_level: 'warning',
      message: `Fator de custo ${fatorCusto.toFixed(2)}x acima do esperado (${FATOR_CUSTO_WARNING}x)`,
      details: { fator_custo: fatorCusto, threshold: FATOR_CUSTO_WARNING },
    });
  }

  if (baseInss >= INSS_CEILING) {
    risks.push({
      tenant_id: tenantId,
      employee_id: employeeId,
      risk_code: 'INSS_CEILING_REACHED',
      risk_level: 'info',
      message: `Base INSS (${baseInss.toFixed(2)}) atingiu teto previdenciário`,
      details: { base_inss: baseInss, ceiling: INSS_CEILING },
    });
  }

  if (salarioBase <= 0) {
    risks.push({
      tenant_id: tenantId,
      employee_id: employeeId,
      risk_code: 'ZERO_BASE_SALARY',
      risk_level: 'critical',
      message: 'Salário base é zero ou negativo — simulação pode estar inconsistente',
      details: { salario_base: salarioBase },
    });
  }

  // ── Compliance Alerts ──

  // 1. Funcionário abaixo do piso CCT
  if (compliance?.piso_cct && salarioBase < compliance.piso_cct) {
    risks.push({
      tenant_id: tenantId,
      employee_id: employeeId,
      risk_code: 'BELOW_CCT_FLOOR',
      risk_level: 'critical',
      message: `Salário base (${salarioBase.toFixed(2)}) abaixo do piso da CCT (${compliance.piso_cct.toFixed(2)})`,
      details: { salario_base: salarioBase, piso_cct: compliance.piso_cct, deficit: compliance.piso_cct - salarioBase },
    });
  }

  // 2. Excesso de horas extras (CLT Art. 59 — máx 2h/dia)
  const totalHE = (input?.horas_extras_50 ?? 0) + (input?.horas_extras_100 ?? 0);
  if (totalHE > MAX_HE_MENSAL) {
    risks.push({
      tenant_id: tenantId,
      employee_id: employeeId,
      risk_code: 'OVERTIME_EXCESS',
      risk_level: 'warning',
      message: `Total de horas extras (${totalHE}h) excede limite mensal recomendado (${MAX_HE_MENSAL}h) — CLT Art. 59`,
      details: { horas_extras_total: totalHE, limite: MAX_HE_MENSAL, horas_extras_50: input?.horas_extras_50, horas_extras_100: input?.horas_extras_100 },
    });
  }

  // 3. Adicional sem vínculo de risco
  const temAdicionalRisco = !!(input?.insalubridade_grau || input?.periculosidade);
  if (temAdicionalRisco && compliance?.tem_vinculo_risco === false) {
    risks.push({
      tenant_id: tenantId,
      employee_id: employeeId,
      risk_code: 'HAZARD_PAY_WITHOUT_RISK',
      risk_level: 'critical',
      message: 'Adicional de insalubridade/periculosidade sem vínculo de risco ativo — possível irregularidade',
      details: {
        insalubridade_grau: input?.insalubridade_grau,
        periculosidade: input?.periculosidade,
        tem_vinculo_risco: false,
      },
    });
  }

  return risks;
}

export const __DOMAIN_CATALOG = {
  domain: 'Payroll',
  color: 'hsl(55 70% 45%)',
  events: [
    { name: 'PayrollSimulationCreated', description: 'Simulação de folha criada' },
    { name: 'EncargoEstimateUpdated', description: 'Estimativa de encargos atualizada' },
    { name: 'SimulationRiskDetected', description: 'Risco detectado na simulação' },
    { name: 'SimulationApproved', description: 'Simulação aprovada' },
  ],
};
