/**
 * WorkTime Compliance Engine — AntiFraudAnalyzer
 *
 * Detecções implementadas:
 *   1. Múltiplas batidas em curto intervalo (duplicate_clock)
 *   2. Batidas fora do padrão histórico (pattern_anomaly)
 *   3. Alternância suspeita de dispositivos (device_tamper)
 *   4. Tentativas fora da geofence (location_spoof)
 *   5. Velocidade impossível (velocity_impossible)
 *   6. Abuso de offline sync (offline_abuse)
 *   7. Horário anômalo (time_anomaly)
 *   8. Precisão GPS baixa (location_spoof)
 *
 * Se suspeito: status → flagged + notificar gestor
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

    // Run all checks in parallel where possible
    const [dupSignal, velSignal, patternSignal, deviceSwapSignal, geofenceSignal, offlineSignal] =
      await Promise.all([
        this.checkDuplicate(tenantId, entry),
        this.checkVelocity(tenantId, entry),
        this.checkHistoricalPattern(tenantId, entry),
        this.checkDeviceSwapping(tenantId, entry),
        this.checkGeofenceAttempts(tenantId, entry),
        entry.is_offline_sync ? this.checkOfflineAbuse(tenantId, entry) : Promise.resolve(null),
      ]);

    if (dupSignal) signals.push(dupSignal);
    if (velSignal) signals.push(velSignal);
    if (patternSignal) signals.push(patternSignal);
    if (deviceSwapSignal) signals.push(deviceSwapSignal);
    if (geofenceSignal) signals.push(geofenceSignal);
    if (offlineSignal) signals.push(offlineSignal);

    // GPS accuracy anomaly
    if (entry.accuracy_meters && entry.accuracy_meters > 500) {
      signals.push({
        type: 'location_spoof',
        severity: entry.accuracy_meters > 1000 ? 'high' : 'medium',
        confidence: Math.min(0.9, entry.accuracy_meters / 2000),
        evidence: { accuracy_meters: entry.accuracy_meters, threshold: 500 },
        action: entry.accuracy_meters > 1000 ? 'flag' : 'none',
      });
    }

    // Time anomaly (00:00-04:00)
    const hour = new Date(entry.recorded_at).getUTCHours();
    if (hour >= 0 && hour < 4) {
      signals.push({
        type: 'time_anomaly',
        severity: 'low',
        confidence: 0.3,
        evidence: { hour, note: 'Batida entre 00:00-04:00' },
        action: 'none',
      });
    }

    // ── Persist fraud logs & apply consequences ──
    const logs: WorkTimeFraudLog[] = [];
    const shouldFlag = signals.some(s => s.action === 'flag' || s.action === 'block' || s.action === 'notify_manager');

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

    // If any actionable signal → mark entry as flagged
    if (shouldFlag && entry.status === 'valid') {
      await supabase
        .from('worktime_ledger' as any)
        .update({ status: 'flagged' })
        .eq('id', entry.id);
    }

    // Notify manager for high-severity signals
    const shouldNotify = signals.some(
      s => s.severity === 'high' || s.severity === 'critical' || s.action === 'notify_manager'
    );
    if (shouldNotify) {
      await this.notifyManager(tenantId, entry, signals);
    }

    return logs;
  }

  // ── 1. Múltiplas batidas em curto intervalo ──

  private async checkDuplicate(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    // Window: ±5 minutes (more aggressive than before)
    const WINDOW_MINUTES = 5;
    const entryTime = new Date(entry.recorded_at).getTime();
    const windowStart = new Date(entryTime - WINDOW_MINUTES * 60000).toISOString();
    const windowEnd = new Date(entryTime + WINDOW_MINUTES * 60000).toISOString();

    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('id, event_type, recorded_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .gte('recorded_at', windowStart)
      .lte('recorded_at', windowEnd)
      .neq('id', entry.id);

    if (!data || data.length === 0) return null;

    const sameType = (data as any[]).filter(d => d.event_type === entry.event_type);
    const anyType = data as any[];

    if (sameType.length > 0) {
      return {
        type: 'duplicate_clock',
        severity: 'high',
        confidence: 0.9,
        evidence: {
          duplicate_ids: sameType.map(d => d.id),
          window_minutes: WINDOW_MINUTES,
          same_event_type: true,
          total_in_window: anyType.length + 1,
        },
        action: 'flag',
      };
    }

    // Multiple different types in very short window (< 1 min) is suspicious
    const veryClose = anyType.filter(d => {
      const diff = Math.abs(new Date(d.recorded_at).getTime() - entryTime);
      return diff < 60000; // < 1 minute
    });

    if (veryClose.length >= 2) {
      return {
        type: 'duplicate_clock',
        severity: 'medium',
        confidence: 0.7,
        evidence: {
          rapid_entries: veryClose.length + 1,
          window_seconds: 60,
          entry_ids: veryClose.map((d: any) => d.id),
        },
        action: 'flag',
      };
    }

    return null;
  }

  // ── 2. Batidas fora do padrão histórico ──

  private async checkHistoricalPattern(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    // Get last 30 days of same event_type to build a pattern
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('recorded_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .eq('event_type', entry.event_type)
      .gte('recorded_at', thirtyDaysAgo)
      .neq('id', entry.id)
      .order('recorded_at', { ascending: false })
      .limit(60);

    if (!data || data.length < 7) return null; // Not enough history

    // Calculate average hour + stddev
    const hours = (data as any[]).map(d => {
      const date = new Date(d.recorded_at);
      return date.getHours() + date.getMinutes() / 60;
    });

    const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
    const variance = hours.reduce((sum, h) => sum + (h - avgHour) ** 2, 0) / hours.length;
    const stddev = Math.sqrt(variance);

    const entryDate = new Date(entry.recorded_at);
    const entryHour = entryDate.getHours() + entryDate.getMinutes() / 60;
    const deviation = Math.abs(entryHour - avgHour);

    // If more than 3 standard deviations from mean → anomaly
    if (stddev > 0 && deviation > Math.max(3 * stddev, 2)) {
      return {
        type: 'pattern_anomaly',
        severity: deviation > 4 * stddev ? 'high' : 'medium',
        confidence: Math.min(0.85, deviation / (6 * stddev)),
        evidence: {
          entry_hour: Math.round(entryHour * 100) / 100,
          avg_hour: Math.round(avgHour * 100) / 100,
          stddev_hours: Math.round(stddev * 100) / 100,
          deviation_hours: Math.round(deviation * 100) / 100,
          sigma: Math.round((deviation / stddev) * 10) / 10,
          sample_size: hours.length,
        },
        action: 'notify_manager',
      };
    }

    return null;
  }

  // ── 3. Alternância suspeita de dispositivos ──

  private async checkDeviceSwapping(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    if (!entry.device_fingerprint) return null;

    // Check last 24h for different devices used
    const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString();

    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('device_fingerprint, recorded_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .gte('recorded_at', oneDayAgo)
      .neq('id', entry.id)
      .not('device_fingerprint', 'is', null);

    if (!data || data.length === 0) return null;

    const uniqueDevices = new Set((data as any[]).map(d => d.device_fingerprint));
    uniqueDevices.add(entry.device_fingerprint);

    // 3+ different devices in 24h is suspicious
    if (uniqueDevices.size >= 3) {
      // Check rapid switching (different device within 30 min)
      const recentEntries = (data as any[])
        .filter(d => {
          const diff = Math.abs(new Date(d.recorded_at).getTime() - new Date(entry.recorded_at).getTime());
          return diff < 30 * 60000 && d.device_fingerprint !== entry.device_fingerprint;
        });

      const severity: FraudSeverity = recentEntries.length > 0 ? 'high' : 'medium';

      return {
        type: 'device_tamper',
        severity,
        confidence: Math.min(0.85, uniqueDevices.size * 0.25),
        evidence: {
          unique_devices_24h: uniqueDevices.size,
          devices: Array.from(uniqueDevices),
          rapid_switches: recentEntries.length,
          rapid_switch_window_minutes: 30,
        },
        action: severity === 'high' ? 'flag' : 'notify_manager',
      };
    }

    return null;
  }

  // ── 4. Tentativas fora da geofence ──

  private async checkGeofenceAttempts(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    if (!entry.geofence_id && !entry.latitude) return null;

    // If entry didn't match any geofence, it's already suspicious
    if (!entry.geofence_matched && entry.latitude != null && entry.longitude != null) {
      // Check how many out-of-fence attempts in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const { data } = await supabase
        .from('worktime_ledger' as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('employee_id', entry.employee_id)
        .eq('geofence_matched', false)
        .gte('recorded_at', sevenDaysAgo)
        .not('latitude', 'is', null);

      const outOfFenceCount = (data as any[])?.length ?? 0;

      if (outOfFenceCount >= 3) {
        return {
          type: 'location_spoof',
          severity: outOfFenceCount >= 5 ? 'critical' : 'high',
          confidence: Math.min(0.9, outOfFenceCount * 0.15),
          evidence: {
            out_of_fence_7d: outOfFenceCount,
            current_lat: entry.latitude,
            current_lng: entry.longitude,
            pattern: 'repeated_geofence_violations',
          },
          action: outOfFenceCount >= 5 ? 'block' : 'flag',
        };
      }

      if (outOfFenceCount >= 1) {
        return {
          type: 'location_spoof',
          severity: 'medium',
          confidence: 0.5,
          evidence: {
            out_of_fence_7d: outOfFenceCount,
            current_lat: entry.latitude,
            current_lng: entry.longitude,
          },
          action: 'notify_manager',
        };
      }
    }

    return null;
  }

  // ── 5. Velocidade impossível ──

  private async checkVelocity(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    if (!entry.latitude || !entry.longitude) return null;

    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('latitude, longitude, recorded_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .lt('recorded_at', entry.recorded_at)
      .not('latitude', 'is', null)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return null;

    const prev = data[0] as any;
    if (!prev.latitude || !prev.longitude) return null;

    const distKm = this.haversineKm(entry.latitude, entry.longitude, prev.latitude, prev.longitude);
    const timeDiffHours = (new Date(entry.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 3600000;

    if (timeDiffHours <= 0) return null;

    const speedKmh = distKm / timeDiffHours;

    if (speedKmh > 200) {
      return {
        type: 'velocity_impossible',
        severity: 'critical',
        confidence: Math.min(0.95, speedKmh / 500),
        evidence: {
          speed_kmh: Math.round(speedKmh),
          distance_km: Math.round(distKm * 10) / 10,
          time_diff_minutes: Math.round(timeDiffHours * 60),
          from: { lat: prev.latitude, lng: prev.longitude },
          to: { lat: entry.latitude, lng: entry.longitude },
        },
        action: 'block',
      };
    }

    return null;
  }

  // ── 6. Abuso de offline ──

  private async checkOfflineAbuse(tenantId: string, entry: WorkTimeLedgerEntry): Promise<FraudSignal | null> {
    const today = entry.recorded_at.split('T')[0];
    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', entry.employee_id)
      .eq('is_offline_sync', true)
      .gte('recorded_at', `${today}T00:00:00Z`)
      .lte('recorded_at', `${today}T23:59:59Z`);

    const count = (data as any[])?.length ?? 0;
    if (count > 4) {
      return {
        type: 'offline_abuse',
        severity: count > 8 ? 'high' : 'medium',
        confidence: Math.min(0.8, count * 0.1),
        evidence: { offline_count_today: count, threshold: 4 },
        action: 'notify_manager',
      };
    }
    return null;
  }

  // ── Manager notification ──

  private async notifyManager(
    tenantId: string,
    entry: WorkTimeLedgerEntry,
    signals: FraudSignal[],
  ): Promise<void> {
    try {
      // Insert a notification record for manager review
      await supabase
        .from('audit_logs' as any)
        .insert({
          tenant_id: tenantId,
          entity_type: 'worktime_fraud',
          entity_id: entry.id,
          action: 'fraud_alert',
          user_id: entry.employee_id,
          metadata: {
            employee_id: entry.employee_id,
            event_type: entry.event_type,
            recorded_at: entry.recorded_at,
            fraud_signals: signals.map(s => ({
              type: s.type,
              severity: s.severity,
              confidence: s.confidence,
              action: s.action,
            })),
            total_signals: signals.length,
            max_severity: this.maxSeverity(signals),
          },
        });
    } catch (err) {
      console.error('[AntiFraudAnalyzer] Failed to notify manager:', err);
    }
  }

  private maxSeverity(signals: FraudSignal[]): FraudSeverity {
    const order: FraudSeverity[] = ['low', 'medium', 'high', 'critical'];
    let max = 0;
    for (const s of signals) {
      const idx = order.indexOf(s.severity);
      if (idx > max) max = idx;
    }
    return order[max];
  }

  // ── Public queries ──

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

  // ── Helpers ──

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
