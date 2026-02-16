/**
 * Compensation Timeline Service
 * Aggregates contracts, adjustments, additionals and history into a unified timeline.
 */

import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { SalaryContract, SalaryAdjustment, SalaryAdditional, SalaryHistory } from '@/domains/shared/types';

export interface CompensationTimelineEvent {
  id: string;
  type: 'contract' | 'adjustment' | 'additional' | 'history';
  date: string;
  description: string;
  amount: number;
  metadata: Record<string, unknown>;
}

export const compensationTimelineService = {
  async getByEmployee(employeeId: string, scope: QueryScope): Promise<CompensationTimelineEvent[]> {
    const [contractsRes, adjustmentsRes, additionalsRes, historyRes] = await Promise.all([
      applyScope(supabase.from('salary_contracts').select('*'), scope).eq('employee_id', employeeId).order('start_date', { ascending: false }),
      applyScope(supabase.from('salary_adjustments').select('*'), scope).eq('employee_id', employeeId).order('created_at', { ascending: false }),
      applyScope(supabase.from('salary_additionals').select('*'), scope).eq('employee_id', employeeId).order('created_at', { ascending: false }),
      applyScope(supabase.from('salary_history').select('*'), scope).eq('employee_id', employeeId).order('effective_date', { ascending: false }),
    ]);

    const events: CompensationTimelineEvent[] = [];

    ((contractsRes.data || []) as SalaryContract[]).forEach((c) => {
      events.push({
        id: c.id, type: 'contract', date: c.start_date,
        description: `Contrato salarial${c.is_active ? ' (ativo)' : ' (encerrado)'}`,
        amount: c.base_salary,
        metadata: { is_active: c.is_active, end_date: c.end_date },
      });
    });

    ((adjustmentsRes.data || []) as SalaryAdjustment[]).forEach((a) => {
      const pct = a.percentage ? ` (+${a.percentage}%)` : '';
      events.push({
        id: a.id, type: 'adjustment', date: a.created_at,
        description: `Ajuste ${a.adjustment_type}${pct}: R$ ${a.previous_salary.toLocaleString('pt-BR')} → R$ ${a.new_salary.toLocaleString('pt-BR')}`,
        amount: a.new_salary,
        metadata: { adjustment_type: a.adjustment_type, percentage: a.percentage, reason: a.reason },
      });
    });

    ((additionalsRes.data || []) as SalaryAdditional[]).forEach((a) => {
      events.push({
        id: a.id, type: 'additional', date: a.start_date,
        description: `Adicional ${a.additional_type}${a.is_recurring ? ' (recorrente)' : ''}`,
        amount: a.amount,
        metadata: { additional_type: a.additional_type, is_recurring: a.is_recurring, description: a.description },
      });
    });

    ((historyRes.data || []) as SalaryHistory[]).forEach((h) => {
      events.push({
        id: h.id, type: 'history', date: h.effective_date,
        description: `Alteração salarial: R$ ${h.previous_salary.toLocaleString('pt-BR')} → R$ ${h.new_salary.toLocaleString('pt-BR')}`,
        amount: h.new_salary,
        metadata: { reason: h.reason },
      });
    });

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events;
  },
};
