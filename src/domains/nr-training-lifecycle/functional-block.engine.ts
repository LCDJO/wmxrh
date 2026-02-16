/**
 * Functional Block Engine
 *
 * Determines whether an employee should be operationally restricted
 * based on expired/overdue mandatory NR trainings.
 *
 * Blocking rules:
 *   - NR-10, NR-33, NR-35 → hard_block (impedido de exercer função)
 *   - NR-6, NR-11, NR-12, NR-18, NR-32 → soft_block (restrição parcial)
 *   - Outros → warning (alerta sem bloqueio operacional)
 *
 * Only hard_block and soft_block trigger operacao_restrita = true
 */

import { supabase } from '@/integrations/supabase/client';
import type { BlockingLevel, TrainingAssignment } from './types';

// ── Blocking classification (mirrors edge function) ──

const HARD_BLOCK_NRS = new Set([10, 33, 35]);
const SOFT_BLOCK_NRS = new Set([6, 11, 12, 18, 32]);

export function classifyBlockingLevel(nrNumber: number): BlockingLevel {
  if (HARD_BLOCK_NRS.has(nrNumber)) return 'hard_block';
  if (SOFT_BLOCK_NRS.has(nrNumber)) return 'soft_block';
  return 'warning';
}

export function isOperationallyRestricted(blockingLevel: BlockingLevel): boolean {
  return blockingLevel === 'hard_block' || blockingLevel === 'soft_block';
}

// ── Read models ──

export interface EmployeeRestrictionStatus {
  employee_id: string;
  operacao_restrita: boolean;
  restricao_motivo: RestrictionReason[] | null;
  blocked_trainings: BlockedTrainingSummary[];
}

export interface RestrictionReason {
  nr: number;
  assignment_id: string;
  expired_at: string;
}

export interface BlockedTrainingSummary {
  assignment_id: string;
  nr_number: number;
  training_name: string;
  blocking_level: BlockingLevel;
  status: string;
  expired_or_due_date: string;
}

// ── Service ──

export const functionalBlockEngine = {
  /**
   * Check if an employee is currently restricted and why.
   */
  async getRestrictionStatus(
    employeeId: string,
    tenantId: string,
  ): Promise<EmployeeRestrictionStatus> {
    const [employeeRes, assignmentsRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, operacao_restrita, restricao_motivo')
        .eq('id', employeeId)
        .eq('tenant_id', tenantId)
        .single(),
      supabase
        .from('nr_training_assignments')
        .select('id, nr_number, training_name, blocking_level, status, data_validade, due_date')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .in('status', ['expired', 'overdue'])
        .in('blocking_level', ['hard_block', 'soft_block']),
    ]);

    if (employeeRes.error) throw employeeRes.error;

    const blockedTrainings: BlockedTrainingSummary[] = (assignmentsRes.data ?? []).map((a: any) => ({
      assignment_id: a.id,
      nr_number: a.nr_number,
      training_name: a.training_name,
      blocking_level: a.blocking_level as BlockingLevel,
      status: a.status,
      expired_or_due_date: a.data_validade ?? a.due_date ?? '',
    }));

    return {
      employee_id: employeeId,
      operacao_restrita: employeeRes.data?.operacao_restrita ?? false,
      restricao_motivo: (employeeRes.data?.restricao_motivo as unknown as RestrictionReason[] | null) ?? null,
      blocked_trainings: blockedTrainings,
    };
  },

  /**
   * List all employees currently with operacao_restrita = true.
   */
  async listRestrictedEmployees(tenantId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, operacao_restrita, restricao_motivo, company_id, department_id, position_id')
      .eq('tenant_id', tenantId)
      .eq('operacao_restrita', true);

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Check if an employee can perform a specific NR-regulated activity.
   * Returns false if they have a blocking assignment for that NR.
   */
  async canPerformActivity(
    employeeId: string,
    tenantId: string,
    nrNumber: number,
  ): Promise<{ allowed: boolean; reason?: string; blocking_level?: BlockingLevel }> {
    const { data, error } = await supabase
      .from('nr_training_assignments')
      .select('id, blocking_level, status, training_name')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .eq('nr_number', nrNumber)
      .in('status', ['expired', 'overdue'])
      .in('blocking_level', ['hard_block', 'soft_block'])
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const block = data[0];
      return {
        allowed: false,
        reason: `Treinamento ${block.training_name} (NR-${nrNumber}) ${block.status === 'expired' ? 'expirado' : 'em atraso'}. Colaborador impedido de exercer atividade regulamentada.`,
        blocking_level: block.blocking_level as BlockingLevel,
      };
    }

    return { allowed: true };
  },
};
