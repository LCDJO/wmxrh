/**
 * ComplianceService — Fleet compliance incident management.
 *
 * Integrates behavior events with the compliance tracking system:
 *  ├── Automatic incident creation from behavior events
 *  ├── Compliance status tracking per device/employee
 *  ├── Warning issuance integration
 *  └── Disciplinary policy evaluation
 */
import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export interface ComplianceIncident {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  device_id: string;
  company_id: string | null;
  violation_type: string;
  severity: string;
  evidence: Record<string, unknown>;
  status: string;
  behavior_event_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceSummary {
  totalIncidents: number;
  pendingReview: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byViolationType: Record<string, number>;
}

// ══════════════════════════════════════════════════════════
// QUERIES
// ══════════════════════════════════════════════════════════

/**
 * Get compliance incidents for a tenant.
 */
export async function getComplianceIncidents(
  tenantId: string,
  opts?: { status?: string; deviceId?: string; employeeId?: string; limit?: number }
): Promise<ComplianceIncident[]> {
  let query = supabase
    .from('fleet_compliance_incidents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50);

  if (opts?.status) query = query.eq('status', opts.status);
  if (opts?.deviceId) query = query.eq('device_id', opts.deviceId);
  if (opts?.employeeId) query = query.eq('employee_id', opts.employeeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as ComplianceIncident[];
}

/**
 * Get compliance summary for a tenant.
 */
export async function getComplianceSummary(
  tenantId: string,
  days = 30
): Promise<ComplianceSummary> {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const { data, error } = await supabase
    .from('fleet_compliance_incidents')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', from.toISOString());

  if (error) throw new Error(error.message);
  const incidents = (data || []) as unknown as ComplianceIncident[];

  const byStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byViolationType: Record<string, number> = {};

  for (const inc of incidents) {
    byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    byViolationType[inc.violation_type] = (byViolationType[inc.violation_type] || 0) + 1;
  }

  return {
    totalIncidents: incidents.length,
    pendingReview: incidents.filter(i => i.status === 'pending').length,
    byStatus,
    bySeverity,
    byViolationType,
  };
}

/**
 * Create a compliance incident from a behavior event.
 */
export async function createComplianceIncident(
  tenantId: string,
  incident: {
    device_id: string;
    employee_id?: string | null;
    company_id?: string | null;
    violation_type: string;
    severity: string;
    evidence: Record<string, unknown>;
    behavior_event_id?: string | null;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('fleet_compliance_incidents')
    .insert([{
      tenant_id: tenantId,
      device_id: incident.device_id,
      employee_id: incident.employee_id || null,
      company_id: incident.company_id || null,
      violation_type: incident.violation_type,
      severity: incident.severity,
      evidence: incident.evidence as unknown as Record<string, string>,
      status: 'pending',
      behavior_event_id: incident.behavior_event_id || null,
    }])
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Review a compliance incident.
 */
export async function reviewIncident(
  tenantId: string,
  incidentId: string,
  review: { status: 'confirmed' | 'dismissed' | 'escalated'; notes?: string; reviewerId: string }
): Promise<void> {
  const { error } = await supabase
    .from('fleet_compliance_incidents')
    .update({
      status: review.status,
      notes: review.notes || null,
      reviewed_by: review.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', incidentId)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(error.message);
}
