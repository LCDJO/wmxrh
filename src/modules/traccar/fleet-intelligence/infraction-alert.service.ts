/**
 * InfractionAlertService — Geração de infrações e alertas de frota.
 */
import { supabase } from '@/integrations/supabase/client';
import { evaluateDisciplinaryAction } from '@/layers/tenant/traccar-config.types';
import type { TenantDisciplinaryPolicy, DisciplinaryAction } from '@/layers/tenant/traccar-config.types';
import type { BehaviorEvent } from '../engines/types';

const db = supabase as any;

export interface FleetInfraction {
  id: string;
  tenant_id: string;
  device_id: string;
  employee_id: string | null;
  company_id: string | null;
  infraction_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, unknown>;
  location_lat: number | null;
  location_lng: number | null;
  occurred_at: string;
  status: 'pending' | 'confirmed' | 'dismissed' | 'escalated';
  disciplinary_action: DisciplinaryAction | null;
  created_at: string;
}

export interface FleetAlert {
  id: string;
  tenant_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  device_id: string | null;
  employee_id: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export interface GenerateInfractionsResult {
  infractions_created: number;
  alerts_created: number;
  escalations: Array<{ employee_id: string; action: DisciplinaryAction; infraction_count: number }>;
}

export async function generateInfractions(
  tenantId: string,
  behaviorEvents: BehaviorEvent[]
): Promise<GenerateInfractionsResult> {
  if (behaviorEvents.length === 0) {
    return { infractions_created: 0, alerts_created: 0, escalations: [] };
  }

  const incidents = behaviorEvents
    .filter(e => e.severity === 'high' || e.severity === 'critical')
    .map(e => ({
      tenant_id: tenantId,
      device_id: e.device_id,
      employee_id: e.employee_id ?? null,
      company_id: null,
      violation_type: e.event_type,
      severity: e.severity,
      evidence: e.details,
      status: 'pending',
      behavior_event_id: null,
    }));

  if (incidents.length > 0) {
    const { error } = await supabase.from('fleet_compliance_incidents').insert(incidents as any);
    if (error) console.error('Erro ao criar infrações:', error.message);
  }

  return { infractions_created: incidents.length, alerts_created: 0, escalations: [] };
}

export async function evaluateEmployeeEscalation(
  tenantId: string,
  employeeId: string,
  lookbackDays = 90
): Promise<{ action: DisciplinaryAction | null; infractionCount: number; shouldEscalate: boolean }> {
  const { data: policyData } = await db.from('tenant_disciplinary_policies').select('*').eq('tenant_id', tenantId).eq('is_active', true).maybeSingle();

  if (!policyData) {
    return { action: null, infractionCount: 0, shouldEscalate: false };
  }

  const from = new Date();
  from.setDate(from.getDate() - lookbackDays);

  const { count, error } = await supabase
    .from('fleet_compliance_incidents')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('status', 'confirmed' as any)
    .gte('created_at', from.toISOString());

  if (error) throw new Error(error.message);

  const infractionCount = count ?? 0;
  const policy = policyData as unknown as TenantDisciplinaryPolicy;
  const evaluation = evaluateDisciplinaryAction(policy, employeeId, infractionCount);

  return { action: evaluation.action, infractionCount, shouldEscalate: evaluation.shouldEscalate };
}

export async function getFleetAlerts(
  tenantId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<FleetAlert[]> {
  let query = supabase
    .from('integration_health_alerts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50);

  if (opts?.unreadOnly) {
    query = query.eq('is_resolved', false);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((a: any) => ({
    id: a.id,
    tenant_id: a.tenant_id,
    alert_type: a.alert_type ?? 'device_offline',
    severity: a.severity ?? 'warning',
    title: a.alert_type ?? 'Alerta',
    message: a.message ?? '',
    device_id: a.details?.device_id ?? null,
    employee_id: a.details?.employee_id ?? null,
    is_read: a.is_resolved,
    is_resolved: a.is_resolved,
    created_at: a.created_at,
  }));
}

export async function getInfractionCountsByEmployee(
  tenantId: string,
  days = 30
): Promise<Record<string, number>> {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const { data, error } = await supabase
    .from('fleet_compliance_incidents')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .not('employee_id', 'is', null)
    .gte('created_at', from.toISOString());

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const row of (data || [])) {
    const eid = (row as any).employee_id;
    if (eid) counts[eid] = (counts[eid] || 0) + 1;
  }
  return counts;
}
