/**
 * Compliance Rules Engine Service
 * Scans for violations and tracks compliance state.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ComplianceViolation {
  employee_id: string;
  employee_name: string;
  company_id: string;
  violation_type: string;
  severity: string;
  description: string;
}

export interface ComplianceViolationRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  violation_type: string;
  severity: string;
  description: string;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  is_resolved: boolean;
  metadata: Record<string, unknown>;
}

export const complianceRulesService = {
  async scanViolations(tenantId: string) {
    const { data, error } = await supabase.rpc('scan_employee_compliance', {
      _tenant_id: tenantId,
    });
    if (error) throw error;
    return (data || []) as ComplianceViolation[];
  },

  async listTrackedViolations(tenantId: string, onlyUnresolved = true) {
    let q = supabase
      .from('compliance_violations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('detected_at', { ascending: false });

    if (onlyUnresolved) {
      q = q.eq('is_resolved', false);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as ComplianceViolationRecord[];
  },

  async resolveViolation(id: string, resolvedBy: string) {
    const { error } = await supabase
      .from('compliance_violations')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', id);
    if (error) throw error;
  },
};
