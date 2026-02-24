/**
 * Automated Offboarding — Etapa 2: Validação de Pendências
 *
 * Scans the employee's current state across multiple domains to
 * detect unresolved pendencies that must be addressed before
 * the offboarding can proceed.
 *
 * Validated pendencies:
 * - EPI pendente de devolução
 * - Veículo corporativo vinculado
 * - Advertências ativas (disciplinary records)
 * - Banco de horas pendente
 * - Exames ocupacionais pendentes/vencidos
 *
 * Each pendency generates a checklist item with severity and
 * blocking behavior.
 *
 * Integrations:
 * - Employee Master Record Engine (ficha)
 * - Fleet Compliance Engine (veículos)
 * - Safety Automation Engine (EPI, exames)
 * - Time & Attendance Engine (banco de horas)
 * - Security Kernel (audit)
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type PendencyCategory =
  | 'epi_devolucao'
  | 'veiculo_corporativo'
  | 'advertencias_ativas'
  | 'banco_horas'
  | 'exames_pendentes';

export type PendencySeverity = 'blocking' | 'warning' | 'info';

export interface OffboardingPendency {
  category: PendencyCategory;
  title: string;
  description: string;
  severity: PendencySeverity;
  /** Blocks advancing to documents_pending if true */
  blocks_progress: boolean;
  /** Number of items found (e.g., 3 EPIs, 2 warnings) */
  item_count: number;
  /** Raw details for audit */
  details: Record<string, unknown>[];
  /** Suggested checklist category */
  checklist_category: string;
}

export interface PendencyValidationResult {
  employee_id: string;
  tenant_id: string;
  workflow_id: string;
  evaluated_at: string;
  pendencies: OffboardingPendency[];
  total_blocking: number;
  total_warnings: number;
  can_proceed: boolean;
}

// ═══════════════════════════════════════════════
//  Pendency Scanners
// ═══════════════════════════════════════════════

/**
 * Scan for EPIs assigned but not returned.
 */
async function scanEpiPendencies(tenantId: string, employeeId: string): Promise<OffboardingPendency | null> {
  const { data, error } = await supabase
    .from('employee_epi_deliveries' as any)
    .select('id, epi_name, delivered_at, returned_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .is('returned_at', null);

  if (error || !data || data.length === 0) return null;

  return {
    category: 'epi_devolucao',
    title: `${data.length} EPI(s) pendente(s) de devolução`,
    description: 'Equipamentos de proteção individual entregues ao colaborador que ainda não foram devolvidos.',
    severity: 'blocking',
    blocks_progress: true,
    item_count: data.length,
    details: data.map((d: any) => ({ id: d.id, epi_name: d.epi_name, delivered_at: d.delivered_at })),
    checklist_category: 'patrimonio',
  };
}

/**
 * Scan for linked corporate vehicles.
 */
async function scanVehiclePendencies(tenantId: string, employeeId: string): Promise<OffboardingPendency | null> {
  const { data, error } = await supabase
    .from('vehicle_assignments' as any)
    .select('id, vehicle_id, assigned_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .is('returned_at', null);

  if (error || !data || data.length === 0) return null;

  return {
    category: 'veiculo_corporativo',
    title: `${data.length} veículo(s) corporativo(s) vinculado(s)`,
    description: 'Veículos corporativos atribuídos ao colaborador que precisam ser desvinculados.',
    severity: 'blocking',
    blocks_progress: true,
    item_count: data.length,
    details: data.map((d: any) => ({ id: d.id, vehicle_id: d.vehicle_id, assigned_at: d.assigned_at })),
    checklist_category: 'patrimonio',
  };
}

/**
 * Scan for active disciplinary actions (warnings/suspensions).
 */
async function scanDisciplinaryPendencies(tenantId: string, employeeId: string): Promise<OffboardingPendency | null> {
  const { data, error } = await supabase
    .from('employee_disciplinary_records' as any)
    .select('id, type, description, issued_at, status')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('status', 'active');

  if (error || !data || data.length === 0) return null;

  return {
    category: 'advertencias_ativas',
    title: `${data.length} advertência(s)/suspensão(ões) ativa(s)`,
    description: 'Registros disciplinares ativos que devem ser documentados no prontuário antes do desligamento.',
    severity: 'warning',
    blocks_progress: false,
    item_count: data.length,
    details: data.map((d: any) => ({ id: d.id, type: d.type, description: d.description, issued_at: d.issued_at })),
    checklist_category: 'documentacao',
  };
}

/**
 * Scan for pending hour bank balance.
 */
async function scanHourBankPendencies(tenantId: string, employeeId: string): Promise<OffboardingPendency | null> {
  const { data, error } = await supabase
    .from('employee_hour_bank' as any)
    .select('id, balance_minutes, reference_month')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .neq('balance_minutes', 0)
    .order('reference_month', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const balance = (data[0] as any).balance_minutes;
  const hours = Math.abs(Math.floor(balance / 60));
  const mins = Math.abs(balance % 60);
  const sign = balance > 0 ? 'positivo' : 'negativo';

  return {
    category: 'banco_horas',
    title: `Banco de horas ${sign}: ${hours}h${mins > 0 ? `${mins}min` : ''}`,
    description: balance > 0
      ? 'Saldo positivo deve ser pago ou compensado nas verbas rescisórias.'
      : 'Saldo negativo deve ser descontado nas verbas rescisórias.',
    severity: 'warning',
    blocks_progress: false,
    item_count: 1,
    details: data as any[],
    checklist_category: 'financeiro',
  };
}

/**
 * Scan for pending or expired occupational exams.
 */
async function scanExamPendencies(tenantId: string, employeeId: string): Promise<OffboardingPendency | null> {
  const { data, error } = await supabase
    .from('employee_health_exams' as any)
    .select('id, exam_type, status, scheduled_at, expires_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'scheduled', 'expired']);

  if (error || !data || data.length === 0) return null;

  return {
    category: 'exames_pendentes',
    title: `${data.length} exame(s) ocupacional(is) pendente(s)`,
    description: 'Exames ocupacionais pendentes ou vencidos. O exame demissional (ASO) é obrigatório conforme NR-7.',
    severity: 'blocking',
    blocks_progress: true,
    item_count: data.length,
    details: data.map((d: any) => ({ id: d.id, exam_type: d.exam_type, status: d.status, expires_at: d.expires_at })),
    checklist_category: 'exame_demissional',
  };
}

// ═══════════════════════════════════════════════
//  Main Validation Engine
// ═══════════════════════════════════════════════

/**
 * Run all pendency scanners for an employee entering offboarding.
 * Returns a validation result with all detected pendencies.
 *
 * Note: Scanners that fail (e.g., table doesn't exist yet) are
 * silently skipped to allow progressive integration.
 */
export async function validateOffboardingPendencies(
  tenantId: string,
  employeeId: string,
  workflowId: string,
): Promise<PendencyValidationResult> {
  const scanners = [
    scanEpiPendencies(tenantId, employeeId),
    scanVehiclePendencies(tenantId, employeeId),
    scanDisciplinaryPendencies(tenantId, employeeId),
    scanHourBankPendencies(tenantId, employeeId),
    scanExamPendencies(tenantId, employeeId),
  ];

  const results = await Promise.allSettled(scanners);

  const pendencies: OffboardingPendency[] = results
    .filter((r): r is PromiseFulfilledResult<OffboardingPendency | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!);

  const totalBlocking = pendencies.filter(p => p.blocks_progress).length;

  return {
    employee_id: employeeId,
    tenant_id: tenantId,
    workflow_id: workflowId,
    evaluated_at: new Date().toISOString(),
    pendencies,
    total_blocking: totalBlocking,
    total_warnings: pendencies.filter(p => p.severity === 'warning').length,
    can_proceed: totalBlocking === 0,
  };
}

/**
 * Convert detected pendencies into checklist items for insertion.
 */
export function pendenciesToChecklistItems(
  pendencies: OffboardingPendency[],
  tenantId: string,
  workflowId: string,
  startOrdem: number,
): Array<{
  tenant_id: string;
  workflow_id: string;
  category: string;
  title: string;
  description: string;
  ordem: number;
  is_mandatory: boolean;
  is_automated: boolean;
  automation_action: string | null;
  status: string;
}> {
  return pendencies.map((p, i) => ({
    tenant_id: tenantId,
    workflow_id: workflowId,
    category: p.checklist_category,
    title: `[PENDÊNCIA] ${p.title}`,
    description: p.description,
    ordem: startOrdem + i,
    is_mandatory: p.blocks_progress,
    is_automated: false,
    automation_action: null,
    status: 'pending',
  }));
}
