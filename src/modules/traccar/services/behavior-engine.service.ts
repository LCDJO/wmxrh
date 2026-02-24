/**
 * BehaviorEngineService — Fleet behavior analysis integration.
 *
 * Connects Traccar telemetry events to the behavioral scoring system:
 *  ├── Speed violation detection and grading
 *  ├── Geofence breach detection
 *  ├── After-hours driving detection
 *  ├── Harsh driving event inference (rapid deceleration)
 *  └── Integration with fleet_behavior_events table
 */
import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export interface BehaviorEvent {
  id: string;
  tenant_id: string;
  device_id: string;
  employee_id: string | null;
  event_type: string;
  severity: string;
  details: Record<string, unknown>;
  event_timestamp: string;
  created_at: string;
}

export interface BehaviorSummary {
  totalEvents: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  recentEvents: BehaviorEvent[];
}

export type BehaviorEventType =
  | 'overspeed'
  | 'harsh_brake'
  | 'after_hours'
  | 'geofence_violation'
  | 'excessive_idle'
  | 'unauthorized_route';

// ══════════════════════════════════════════════════════════
// QUERIES
// ══════════════════════════════════════════════════════════

/**
 * Get behavior events for a tenant within a time range.
 */
export async function getBehaviorEvents(
  tenantId: string,
  opts?: { deviceId?: string; employeeId?: string; from?: string; to?: string; limit?: number }
): Promise<BehaviorEvent[]> {
  let query = supabase
    .from('fleet_behavior_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('event_timestamp', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.deviceId) query = query.eq('device_id', opts.deviceId);
  if (opts?.employeeId) query = query.eq('employee_id', opts.employeeId);
  if (opts?.from) query = query.gte('event_timestamp', opts.from);
  if (opts?.to) query = query.lte('event_timestamp', opts.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as BehaviorEvent[];
}

/**
 * Get a behavior summary for a device or employee.
 */
export async function getBehaviorSummary(
  tenantId: string,
  opts?: { deviceId?: string; employeeId?: string; days?: number }
): Promise<BehaviorSummary> {
  const from = new Date();
  from.setDate(from.getDate() - (opts?.days ?? 30));

  const events = await getBehaviorEvents(tenantId, {
    deviceId: opts?.deviceId,
    employeeId: opts?.employeeId,
    from: from.toISOString(),
    limit: 500,
  });

  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const evt of events) {
    bySeverity[evt.severity] = (bySeverity[evt.severity] || 0) + 1;
    byType[evt.event_type] = (byType[evt.event_type] || 0) + 1;
  }

  return {
    totalEvents: events.length,
    bySeverity,
    byType,
    recentEvents: events.slice(0, 10),
  };
}

/**
 * Record a new behavior event.
 */
export async function recordBehaviorEvent(
  tenantId: string,
  event: {
    device_id: string;
    employee_id?: string | null;
    company_id?: string | null;
    event_type: BehaviorEventType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: Record<string, unknown>;
    event_timestamp?: string;
    source_event_id?: string;
  }
): Promise<void> {
  const { error } = await supabase.from('fleet_behavior_events').insert([{
    tenant_id: tenantId,
    device_id: event.device_id,
    employee_id: event.employee_id || null,
    company_id: event.company_id || null,
    event_type: event.event_type,
    severity: event.severity,
    details: event.details as unknown as Record<string, string>,
    source_event_id: event.source_event_id || null,
    event_timestamp: event.event_timestamp || new Date().toISOString(),
  }]);

  if (error) throw new Error(error.message);
}

/**
 * Evaluate speed violation severity based on excess percentage.
 */
export function evaluateSpeedSeverity(
  speedKmh: number,
  limitKmh: number
): { severity: 'low' | 'medium' | 'high' | 'critical'; excessPct: number } {
  const excessPct = ((speedKmh - limitKmh) / limitKmh) * 100;

  if (excessPct >= 50) return { severity: 'critical', excessPct };
  if (excessPct >= 30) return { severity: 'high', excessPct };
  if (excessPct >= 10) return { severity: 'medium', excessPct };
  return { severity: 'low', excessPct };
}
