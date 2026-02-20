/**
 * Career Risk Alert Service — Legal risk detection and tracking
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { scopedInsert } from '@/domains/shared/scoped-query';
import type { CareerRiskAlert, CreateCareerRiskAlertDTO } from './types';

export const riskAlertService = {
  async listOpen(scope: QueryScope): Promise<CareerRiskAlert[]> {
    const { data, error } = await supabase
      .from('career_risk_alerts')
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .eq('resolvido', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as CareerRiskAlert[];
  },

  async create(dto: CreateCareerRiskAlertDTO, scope: QueryScope): Promise<CareerRiskAlert> {
    const secured = scopedInsert(dto, scope) as unknown;
    const { data, error } = await supabase.from('career_risk_alerts').insert(secured as any).select().single();
    if (error) throw error;
    return data as unknown as CareerRiskAlert;
  },

  async resolve(id: string, userId: string, scope: QueryScope): Promise<void> {
    const { error } = await supabase
      .from('career_risk_alerts')
      .update({ resolvido: true, resolvido_em: new Date().toISOString(), resolvido_por: userId })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },

  async countBySeverity(scope: QueryScope): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('career_risk_alerts')
      .select('severidade')
      .eq('tenant_id', scope.tenantId)
      .eq('resolvido', false);
    if (error) throw error;
    const counts: Record<string, number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };
    (data || []).forEach((r: { severidade: string }) => { counts[r.severidade] = (counts[r.severidade] || 0) + 1; });
    return counts;
  },
};
