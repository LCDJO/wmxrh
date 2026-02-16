/**
 * PCMSO Alerts Service
 * Queries the pcmso_exam_alerts view for overdue/expiring exams.
 */

import { supabase } from '@/integrations/supabase/client';

export type ExamAlertStatus = 'overdue' | 'expiring_soon' | 'upcoming' | 'ok';

export interface PcmsoExamAlert {
  exam_id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  company_id: string;
  exam_type: string;
  exam_date: string;
  next_exam_date: string | null;
  result: string;
  health_program_id: string | null;
  program_name: string | null;
  alert_status: ExamAlertStatus;
  days_until_due: number | null;
}

export const pcmsoAlertService = {
  async listAlerts(tenantId: string, statuses?: ExamAlertStatus[]) {
    let q = supabase
      .from('pcmso_exam_alerts' as any)
      .select('*')
      .eq('tenant_id', tenantId);

    if (statuses && statuses.length > 0) {
      q = q.in('alert_status', statuses);
    }

    const { data, error } = await (q as any).order('days_until_due', { ascending: true });
    if (error) throw error;
    return (data || []) as PcmsoExamAlert[];
  },

  async listOverdueAndExpiring(tenantId: string) {
    return this.listAlerts(tenantId, ['overdue', 'expiring_soon']);
  },

  async countByStatus(tenantId: string) {
    const alerts = await this.listAlerts(tenantId);
    return {
      overdue: alerts.filter(a => a.alert_status === 'overdue').length,
      expiring_soon: alerts.filter(a => a.alert_status === 'expiring_soon').length,
      upcoming: alerts.filter(a => a.alert_status === 'upcoming').length,
      ok: alerts.filter(a => a.alert_status === 'ok').length,
      total: alerts.length,
    };
  },
};
