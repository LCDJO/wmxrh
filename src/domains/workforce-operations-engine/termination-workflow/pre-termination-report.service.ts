/**
 * Pre-Termination Report Engine
 *
 * Generates a comprehensive pre-dismissal report containing:
 *   1. Disciplinary history (warnings, suspensions, escalation)
 *   2. Formal warnings (advertências) with signature status
 *   3. Legal risk assessment (LegalRiskScore)
 *   4. Labor exposure analysis (financial + legal)
 *   5. Compliance summary (SST, agreements, documents)
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getTerminationSimulatorService,
  type LegalRiskScore,
  type TerminationSimulationInput,
} from './termination-simulator.service';
import type { OffboardingType, AvisoPrevioType } from '@/domains/automated-offboarding/types';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface DisciplinaryRecord {
  id: string;
  event_type: string;
  description: string;
  incident_id: string | null;
  warning_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WarningRecord {
  id: string;
  warning_type: string;
  description: string;
  issued_at: string;
  issued_by: string | null;
  incident_id: string | null;
  signature_status: string;
  signed_at: string | null;
  document_url: string | null;
}

export interface LaborExposure {
  category: string;
  description: string;
  estimated_value_brl: number;
  probability: 'baixa' | 'media' | 'alta' | 'certa';
  legal_basis: string;
}

export interface ComplianceGap {
  area: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  action_required: string;
}

export interface PreTerminationReport {
  generated_at: string;
  employee_id: string;
  employee_name: string;
  tenant_id: string;

  // Section 1: Disciplinary
  disciplinary_summary: {
    total_events: number;
    by_type: Record<string, number>;
    escalation_level: string;
    records: DisciplinaryRecord[];
  };

  // Section 2: Warnings
  warnings_summary: {
    total: number;
    verbal: number;
    written: number;
    suspension: number;
    unsigned: number;
    records: WarningRecord[];
  };

  // Section 3: Legal Risk
  legal_risk: LegalRiskScore;

  // Section 4: Labor Exposure
  labor_exposure: {
    total_estimated_brl: number;
    items: LaborExposure[];
    worst_case_brl: number;
  };

  // Section 5: Compliance Gaps
  compliance_gaps: ComplianceGap[];

  // Section 6: Recommendation
  recommendation: {
    proceed: boolean;
    summary: string;
    required_actions: string[];
  };
}

// ══════════════════════════════════════════════
// DATA LOADERS
// ══════════════════════════════════════════════

async function loadDisciplinaryHistory(tenantId: string, employeeId: string): Promise<DisciplinaryRecord[]> {
  const { data, error } = await supabase
    .from('fleet_disciplinary_history')
    .select('id, event_type, description, incident_id, warning_id, metadata, created_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading disciplinary history:', error);
    return [];
  }
  return (data || []) as DisciplinaryRecord[];
}

async function loadWarnings(tenantId: string, employeeId: string): Promise<WarningRecord[]> {
  const { data, error } = await supabase
    .from('fleet_warnings')
    .select('id, warning_type, description, issued_at, issued_by, incident_id, signature_status, signed_at, document_url')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('issued_at', { ascending: false });
  if (error) {
    console.error('Error loading warnings:', error);
    return [];
  }
  return (data || []) as WarningRecord[];
}

async function loadEmployeeBasicInfo(tenantId: string, employeeId: string): Promise<{
  name: string;
  salario_base: number;
  data_admissao: string;
  saldo_fgts: number;
} | null> {
  try {
    const { data } = await supabase
      .from('employees' as any)
      .select('name, salary, hire_date')
      .eq('id', employeeId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const emp = data as any;
    if (!emp) return null;
    return {
      name: emp.name ?? 'N/A',
      salario_base: emp.salary ?? 0,
      data_admissao: emp.hire_date ?? new Date().toISOString(),
      saldo_fgts: 0, // would come from payroll integration
    };
  } catch {
    return null;
  }
}

async function loadPendingItems(tenantId: string, employeeId: string): Promise<{
  pending_epis: boolean;
  pending_trainings: boolean;
  pending_exams: boolean;
  pending_agreements: boolean;
}> {
  const result = { pending_epis: false, pending_trainings: false, pending_exams: false, pending_agreements: false };

  try {
    // EPIs
    const { count: epiCount } = await supabase
      .from('epi_deliveries' as any)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .is('returned_at', null);
    result.pending_epis = (epiCount ?? 0) > 0;
  } catch { /* table may not exist */ }

  try {
    // Training assignments
    const { count: trainCount } = await supabase
      .from('nr_training_assignments' as any)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .neq('status', 'completed');
    result.pending_trainings = (trainCount ?? 0) > 0;
  } catch { /* table may not exist */ }

  try {
    // Agreements unsigned
    const { count: agrCount } = await supabase
      .from('employee_agreements' as any)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .neq('status', 'signed');
    result.pending_agreements = (agrCount ?? 0) > 0;
  } catch { /* table may not exist */ }

  return result;
}

// ══════════════════════════════════════════════
// EXPOSURE CALCULATOR
// ══════════════════════════════════════════════

function calculateLaborExposure(
  salarioBase: number,
  offboardingType: OffboardingType,
  disciplinaryCount: number,
  warningsUnsigned: number,
  hasStability: boolean,
): LaborExposure[] {
  const items: LaborExposure[] = [];

  // Reversão de justa causa
  if (offboardingType === 'justa_causa') {
    const aviso30 = salarioBase;
    const feriasProporcionais = salarioBase; // estimate
    const decimoTerceiro = salarioBase;
    const multa40 = salarioBase * 12 * 0.08 * 0.40; // rough FGTS estimate
    const totalReversao = aviso30 + feriasProporcionais + decimoTerceiro + multa40;

    items.push({
      category: 'Reversão Judicial de Justa Causa',
      description: `Se a justa causa for revertida judicialmente, a empresa arcará com todas as verbas rescisórias de demissão sem justa causa.`,
      estimated_value_brl: Math.round(totalReversao * 100) / 100,
      probability: disciplinaryCount < 3 ? 'alta' : 'media',
      legal_basis: 'CLT Art. 482 — Ônus da prova do empregador',
    });
  }

  // Indenização por estabilidade
  if (hasStability) {
    const mesesEstabilidade = 12;
    items.push({
      category: 'Indenização por Estabilidade',
      description: 'Período de estabilidade não respeitado gera indenização substitutiva.',
      estimated_value_brl: salarioBase * mesesEstabilidade,
      probability: 'certa',
      legal_basis: 'Súmula 396 TST',
    });
  }

  // Dano moral por advertências não assinadas
  if (warningsUnsigned > 0) {
    items.push({
      category: 'Risco Probatório — Advertências sem Assinatura',
      description: `${warningsUnsigned} advertência(s) sem assinatura do empregado. Pode ser desconsiderada em juízo.`,
      estimated_value_brl: salarioBase * 2, // estimate de dano moral
      probability: warningsUnsigned > 2 ? 'alta' : 'media',
      legal_basis: 'Princípio da documentação — CLT Art. 482',
    });
  }

  // Horas extras não pagas (risco genérico)
  items.push({
    category: 'Horas Extras Não Compensadas',
    description: 'Risco de reclamação por horas extras, banco de horas, ou intervalos intrajornada.',
    estimated_value_brl: salarioBase * 6, // 6 meses de HE estimado
    probability: 'media',
    legal_basis: 'CLT Art. 59 + Súmula 85 TST',
  });

  return items;
}

// ══════════════════════════════════════════════
// COMPLIANCE GAPS
// ══════════════════════════════════════════════

function identifyComplianceGaps(pending: Awaited<ReturnType<typeof loadPendingItems>>, warningsUnsigned: number): ComplianceGap[] {
  const gaps: ComplianceGap[] = [];

  if (pending.pending_exams) {
    gaps.push({
      area: 'Saúde Ocupacional',
      description: 'Exame demissional obrigatório não realizado.',
      severity: 'critical',
      action_required: 'Agendar ASO demissional antes de formalizar desligamento.',
    });
  }

  if (pending.pending_epis) {
    gaps.push({
      area: 'EPIs',
      description: 'EPIs entregues sem registro de devolução.',
      severity: 'warning',
      action_required: 'Registrar devolução ou termo de responsabilidade.',
    });
  }

  if (pending.pending_trainings) {
    gaps.push({
      area: 'Treinamentos NR',
      description: 'Treinamentos obrigatórios não concluídos durante o vínculo.',
      severity: 'warning',
      action_required: 'Registrar pendência no dossiê para resguardo legal.',
    });
  }

  if (pending.pending_agreements) {
    gaps.push({
      area: 'Termos e Acordos',
      description: 'Termos obrigatórios pendentes de assinatura.',
      severity: 'warning',
      action_required: 'Coletar assinaturas pendentes antes do desligamento.',
    });
  }

  if (warningsUnsigned > 0) {
    gaps.push({
      area: 'Documentação Disciplinar',
      description: `${warningsUnsigned} advertência(s) sem assinatura do colaborador.`,
      severity: warningsUnsigned > 2 ? 'critical' : 'warning',
      action_required: 'Obter assinatura com testemunhas ou registrar recusa formal.',
    });
  }

  return gaps;
}

// ══════════════════════════════════════════════
// REPORT GENERATOR
// ══════════════════════════════════════════════

export async function generatePreTerminationReport(params: {
  tenant_id: string;
  employee_id: string;
  offboarding_type: OffboardingType;
  aviso_previo_type: AvisoPrevioType;
  data_desligamento: string;
  is_pregnant?: boolean;
  is_cipeiro?: boolean;
  is_union_representative?: boolean;
  is_accident_leave?: boolean;
  months_since_accident?: number;
  has_pending_lawsuits?: boolean;
  justa_causa_motivo?: string;
  justa_causa_artigo?: string;
}): Promise<PreTerminationReport> {
  // Load all data in parallel
  const [disciplinary, warnings, employee, pending] = await Promise.all([
    loadDisciplinaryHistory(params.tenant_id, params.employee_id),
    loadWarnings(params.tenant_id, params.employee_id),
    loadEmployeeBasicInfo(params.tenant_id, params.employee_id),
    loadPendingItems(params.tenant_id, params.employee_id),
  ]);

  const empName = employee?.name ?? 'Colaborador';
  const salarioBase = employee?.salario_base ?? 0;
  const dataAdmissao = employee?.data_admissao ?? new Date().toISOString();

  // Disciplinary summary
  const byType: Record<string, number> = {};
  for (const d of disciplinary) {
    byType[d.event_type] = (byType[d.event_type] ?? 0) + 1;
  }

  const escalationLevels = ['verbal_warning', 'written_warning', 'suspension', 'termination'];
  let escalationLevel = 'nenhum';
  for (const lvl of escalationLevels.reverse()) {
    if (byType[lvl] && byType[lvl] > 0) {
      escalationLevel = lvl;
      break;
    }
  }

  // Warnings summary
  const verbal = warnings.filter(w => w.warning_type === 'verbal').length;
  const written = warnings.filter(w => w.warning_type !== 'verbal').length;
  const suspension = disciplinary.filter(d => d.event_type === 'suspension').length;
  const unsigned = warnings.filter(w => w.signature_status !== 'signed').length;

  // Legal Risk Score
  const simulator = getTerminationSimulatorService();
  const riskInput: TerminationSimulationInput = {
    tenant_id: params.tenant_id,
    employee_id: params.employee_id,
    employee_name: empName,
    offboarding_type: params.offboarding_type,
    aviso_previo_type: params.aviso_previo_type,
    salario_base: salarioBase,
    data_admissao: dataAdmissao,
    data_desligamento: params.data_desligamento,
    dias_trabalhados_mes: new Date(params.data_desligamento).getDate(),
    dias_no_mes: new Date(new Date(params.data_desligamento).getFullYear(), new Date(params.data_desligamento).getMonth() + 1, 0).getDate(),
    ferias_vencidas_periodos: 0,
    saldo_fgts: employee?.saldo_fgts ?? 0,
    is_pregnant: params.is_pregnant,
    is_cipeiro: params.is_cipeiro,
    is_union_representative: params.is_union_representative,
    is_accident_leave: params.is_accident_leave,
    months_since_accident: params.months_since_accident,
    has_pending_lawsuits: params.has_pending_lawsuits,
    has_pending_medical_exams: pending.pending_exams,
    has_pending_epis: pending.pending_epis,
    has_pending_trainings: pending.pending_trainings,
    justa_causa_evidence_count: disciplinary.length,
    disciplinary_warnings_count: warnings.length,
    justa_causa_motivo: params.justa_causa_motivo,
    justa_causa_artigo: params.justa_causa_artigo,
  };

  const legalRisk = simulator.computeRiskScore(riskInput);

  // Labor exposure
  const hasStability = !!(params.is_pregnant || params.is_cipeiro || params.is_union_representative || params.is_accident_leave);
  const exposureItems = calculateLaborExposure(
    salarioBase, params.offboarding_type, disciplinary.length, unsigned, hasStability
  );
  const totalExposure = exposureItems.reduce((s, e) => s + e.estimated_value_brl, 0);
  const worstCase = exposureItems
    .filter(e => e.probability !== 'baixa')
    .reduce((s, e) => s + e.estimated_value_brl, 0);

  // Compliance gaps
  const complianceGaps = identifyComplianceGaps(pending, unsigned);

  // Recommendation
  const requiredActions: string[] = [];
  if (legalRisk.blocking_factors.length > 0) {
    requiredActions.push(...legalRisk.blocking_factors.map(f => f.recommendation));
  }
  complianceGaps.filter(g => g.severity === 'critical').forEach(g => requiredActions.push(g.action_required));

  const canProceed = legalRisk.can_proceed && complianceGaps.filter(g => g.severity === 'critical').length === 0;

  let recSummary: string;
  if (canProceed && legalRisk.score >= 80) {
    recSummary = `Desligamento pode prosseguir. Risco jurídico ${legalRisk.level}. Exposição estimada: R$ ${totalExposure.toFixed(2)}.`;
  } else if (canProceed) {
    recSummary = `Desligamento possível com ressalvas. ${complianceGaps.length} pendência(s) de compliance. Exposição: R$ ${totalExposure.toFixed(2)}.`;
  } else {
    recSummary = `⚠️ Desligamento NÃO recomendado. ${legalRisk.blocking_factors.length} fator(es) bloqueante(s) + ${complianceGaps.filter(g => g.severity === 'critical').length} gap(s) crítico(s). Exposição potencial: R$ ${worstCase.toFixed(2)}.`;
  }

  return {
    generated_at: new Date().toISOString(),
    employee_id: params.employee_id,
    employee_name: empName,
    tenant_id: params.tenant_id,
    disciplinary_summary: {
      total_events: disciplinary.length,
      by_type: byType,
      escalation_level: escalationLevel,
      records: disciplinary,
    },
    warnings_summary: {
      total: warnings.length,
      verbal,
      written,
      suspension,
      unsigned,
      records: warnings,
    },
    legal_risk: legalRisk,
    labor_exposure: {
      total_estimated_brl: Math.round(totalExposure * 100) / 100,
      items: exposureItems,
      worst_case_brl: Math.round(worstCase * 100) / 100,
    },
    compliance_gaps: complianceGaps,
    recommendation: {
      proceed: canProceed,
      summary: recSummary,
      required_actions: requiredActions,
    },
  };
}

// ── Service class ──

export class PreTerminationReportService {
  async generate(params: Parameters<typeof generatePreTerminationReport>[0]): Promise<PreTerminationReport> {
    return generatePreTerminationReport(params);
  }
}

let _instance: PreTerminationReportService | null = null;
export function getPreTerminationReportService(): PreTerminationReportService {
  if (!_instance) _instance = new PreTerminationReportService();
  return _instance;
}
