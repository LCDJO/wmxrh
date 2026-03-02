/**
 * WorkTime Compliance Engine — AntiFraudAnalyzer
 * Detects clock fraud patterns: location spoofing, velocity anomalies,
 * device tampering, duplicate clocks, untrusted devices.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  WorkTimeLedgerEntry, WorkTimeFraudLog, FraudType, FraudSeverity,
  FraudAutoAction, AntiFraudAnalyzerAPI, FraudStats,
} from './types';

interface FraudSignal {
  type: FraudType;
  severity: FraudSeverity;
  confidence: number;
  evidence: Record<string, unknown>;
  action: FraudAutoAction;
}

export class AntiFraudAnalyzer implements AntiFraudAnalyzerAPI {

  async analyze(tenantId: string, entry: WorkTimeLedgerEntry): Promise<WorkTimeFraudLog[]> {
    const signals: FraudSignal[] = [];

    // 1. Duplicate clock detection
    const dupSignal = await this.checkDuplicate(tenantId, entry);
    if (dupSignal) signals.push(dupSignal);

    // 2. Velocity check (impossible travel)
    const velSignal = await this.checkVelocity(tenantId, entry);
    if (velSignal) signals.push(velSignal);

    // 3. Location accuracy anomaly
    if (entry.accuracy_meters && entry.accuracy_meters > 500) {
      signals.push({
        type: 'location_spoof',
        severity: entry.accuracy_meters > 1000 ? 'high' : 'medium',
        confidence: Math.min(0.9, entry.accuracy_meters / 2000),
        evidence: { accuracy_meters: entry.accuracy_meters, threshold: 500 },
        action: entry.accuracy_meters > 1000 ? 'flag' : 'none',
      });
    }

    // 4. Offline sync abuse (too many offline entries)
    if (entry.is_offline_sync) {
      const offlineSignal = await this.checkOfflineAbuse(tenantId, entry);
      if (offlineSignal) signals.push(offlineSignal);
    }

    // 5. Time anomaly (clock at unusual hours)
    const hour = new Date(entry.recorded_at).getUTCHours();
    if (hour >= 0 && hour < 4) {
      signals.push({
        type: 'time_anomaly',
        severity: 'low',
        confidence: 0.3,
        evidence: { hour, note: 'Clock event between 00:00-04:00' },
        action: 'none',
      });
    }

    // Persist fraud logs
    const logs: WorkTimeFraudLog[] = [];
    for (const signal of signals) {
      const { data, error } = await supabase
        .from('worktime_fraud_logs' as any)
        .insert({
          tenant_id: tenantId,
          employee_id: entry.employee_id,
          ledger_entry_id: entry.id,
          fraud_type: signal.type,
          severity: signal.severity,
          confidence_score: signal.confidence,
          evidence: signal.evidence,
          auto_action: signal.action,
        })
        .select()
        .single();

      if (!error && data) logs.push(data as unknown as WorkTimeFraudLog);
    }

    return logs;
  }

  async getFraudLogs(tenantId: string, opts?: { employeeId?: string; resolved?: boolean; limit?: number }): Promise<WorkTimeFraudLog[]> {
    let query = supabase
      .from('worktime_fraud_logs' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 100);

    if (opts?.employeeId) query = query.eq('employee_id', opts.employeeId);
    if (opts?.resolved !== undefined) query = query.eq('resolved', opts.resolved);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as WorkTimeFraudLog[];
  }

  async resolve(fraudLogId: string, resolvedBy: string, notes: string): Promise<void> {
    const { error } = await supabase
      .from('worktime_fraud_logs' as any)
      .update({
        resolved: true,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq('id', fraudLogId);
    if (error) throw error;
  }

  async getStats(tenantId: string): Promise<FraudStats> {
    const { data, error } = await supabase
      .from('worktime_fraud_logs' as any)
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) throw error;

    const logs = (data ?? []) as unknown as WorkTimeFraudLog[];

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalConfidence = 0;

    for (const log of logs) {
      byType[log.fraud_type] = (byType[log.fraud_type] ?? 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] ?? 0) + 1;
      totalConfidence += log.confidence_score;
    }

    return {
      total: logs.length,
      unresolved: logs.filter(l => !l.resolved).length,
      by_type: byType as any,
      by_severity: bySeverity as any,
      avg_confidence: logs.length > 0 ? totalConfidence / logs.length : 0,
    };
  }

  // ── Private Checks ──

  private async checkDuplicate(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    const windowStart = new Date(new Date(entry.recorded_at).getTime() - 2 * 60000).toISOString();
    const windowEnd = new Date(new Date(entry.recorded_at).getTime() + 2 * 60000).toISOString();

    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .eq('event_type', entry.event_type)
      .gte('recorded_at', windowStart)
      .lte('recorded_at', windowEnd)
      .neq('id', entry.id)
      .limit(1);

    if (data && data.length > 0) {
      return {
        type: 'duplicate_clock',
        severity: 'medium',
        confidence: 0.8,
        evidence: { existing_entry: (data[0] as any).id, window_minutes: 2 },
        action: 'flag',
      };
    }
    return null;
  }

  private async checkVelocity(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    if (!entry.latitude || !entry.longitude) return null;

    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('latitude, longitude, recorded_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .lt('recorded_at', entry.recorded_at)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return null;

    const prev = data[0] as any;
    if (!prev.latitude || !prev.longitude) return null;

    const distKm = this.haversineKm(entry.latitude, entry.longitude, prev.latitude, prev.longitude);
    const timeDiffHours = (new Date(entry.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 3600000;

    if (timeDiffHours <= 0) return null;

    const speedKmh = distKm / timeDiffHours;

    // Impossible: >200 km/h between two clock events
    if (speedKmh > 200) {
      return {
        type: 'velocity_impossible',
        severity: 'critical',
        confidence: Math.min(0.95, speedKmh / 500),
        evidence: { speed_kmh: Math.round(speedKmh), distance_km: Math.round(distKm * 10) / 10, time_diff_minutes: Math.round(timeDiffHours * 60) },
        action: 'block',
      };
    }

    return null;
  }

  private async checkOfflineAbuse(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    const today = entry.recorded_at.split('T')[0];
    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .eq('is_offline_sync', true)
      .gte('recorded_at', `${today}T00:00:00Z`)
      .lte('recorded_at', `${today}T23:59:59Z`);

    // Allow up to 4 offline syncs per day
    const count = (data as any)?.length ?? 0;
    if (count > 4) {
      return {
        type: 'offline_abuse',
        severity: 'medium',
        confidence: 0.6,
        evidence: { offline_count_today: count, threshold: 4 },
        action: 'notify_manager',
      };
    }
    return null;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
