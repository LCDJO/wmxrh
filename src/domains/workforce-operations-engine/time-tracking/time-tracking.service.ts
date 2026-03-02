/**
 * WorkforceOperationsEngine — Time Tracking Engine
 *
 * Manages:
 *   - Clock-in/out with multi-source support
 *   - Intelligent time bank (banco de horas) with expiry
 *   - Configurable rules per tenant
 *   - Automatic alerts (missing clock, overtime, etc.)
 *   - Daily summary computation
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type ClockEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'holiday' | 'vacation';
export type OvertimeType = 'regular_50' | 'regular_100' | 'nocturnal' | 'holiday';
export type TimeBankEntryType = 'credit' | 'debit' | 'expiry' | 'adjustment';
export type AlertType =
  | 'missing_clock_out' | 'late_arrival' | 'overtime_limit'
  | 'consecutive_overtime' | 'missing_break' | 'bank_expiring'
  | 'nocturnal_exceeded' | 'irregular_pattern';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface ClockEvent {
  id: string;
  tenant_id: string;
  employee_id: string;
  event_type: ClockEventType;
  timestamp: string;
  source: 'manual' | 'biometric' | 'geofence' | 'app';
  latitude: number | null;
  longitude: number | null;
  device_id: string | null;
  notes: string | null;
  approved_by: string | null;
  is_adjusted: boolean;
  adjusted_from: string | null;
  adjustment_reason: string | null;
  created_at: string;
}

export interface DailySummary {
  id: string;
  tenant_id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  first_clock_in: string | null;
  last_clock_out: string | null;
  total_worked_minutes: number;
  break_minutes: number;
  overtime_minutes: number;
  overtime_type: OvertimeType | null;
  is_nocturnal: boolean;
  nocturnal_minutes: number;
  deficit_minutes: number;
  expected_minutes: number;
}

export interface TimeBankEntry {
  id: string;
  tenant_id: string;
  employee_id: string;
  entry_type: TimeBankEntryType;
  minutes: number;
  reference_date: string;
  source_summary_id: string | null;
  reason: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TimeBankBalance {
  employee_id: string;
  balance_minutes: number;
  credit_minutes: number;
  debit_minutes: number;
  expiring_soon_minutes: number;
  entries_count: number;
}

export interface TimeTrackingRule {
  id: string;
  tenant_id: string;
  rule_key: string;
  rule_value: Record<string, unknown>;
  description: string | null;
  is_active: boolean;
}

export interface TimeTrackingAlert {
  id: string;
  tenant_id: string;
  employee_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  reference_date: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TimeTrackingMetrics {
  total_employees: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  avg_worked_minutes: number;
  overtime_employees: number;
  unresolved_alerts: number;
  total_bank_balance_minutes: number;
}

// ══════════════════════════════════════════════
// DEFAULT RULES
// ══════════════════════════════════════════════

export const DEFAULT_TIME_RULES: Record<string, { value: Record<string, unknown>; description: string }> = {
  jornada_diaria: {
    value: { minutes: 480, tolerance_minutes: 10 },
    description: 'Jornada diária padrão (8h) com tolerância de 10min (CLT Art. 58 §1º)',
  },
  intervalo_intrajornada: {
    value: { min_minutes: 60, max_minutes: 120, threshold_hours: 6 },
    description: 'Intervalo mínimo de 1h para jornadas >6h (CLT Art. 71)',
  },
  hora_extra_limite: {
    value: { daily_max_minutes: 120, weekly_max_minutes: 600 },
    description: 'Limite de 2h extras/dia (CLT Art. 59 §1º)',
  },
  adicional_noturno: {
    value: { start_hour: 22, end_hour: 5, reduction_factor: 0.8571, percentage: 20 },
    description: 'Hora noturna reduzida (52min30s) + 20% adicional (CLT Art. 73)',
  },
  banco_horas: {
    value: { enabled: true, expiry_months: 6, max_balance_minutes: 7200, auto_credit: true },
    description: 'Banco de horas com expiração em 6 meses (CLT Art. 59 §5º)',
  },
  alertas: {
    value: {
      missing_clock_out_after_minutes: 720,
      late_threshold_minutes: 15,
      consecutive_overtime_days: 3,
      bank_expiry_alert_days: 30,
    },
    description: 'Configuração de alertas automáticos',
  },
};

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

export class TimeTrackingService {

  // ── Clock Events ──

  async registerClock(tenantId: string, data: {
    employee_id: string;
    event_type: ClockEventType;
    source?: ClockEvent['source'];
    latitude?: number;
    longitude?: number;
    device_id?: string;
    notes?: string;
  }): Promise<ClockEvent> {
    const { data: event, error } = await supabase
      .from('clock_events' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: data.employee_id,
        event_type: data.event_type,
        source: data.source ?? 'manual',
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        device_id: data.device_id ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    // After registering, run alert checks asynchronously
    this.runAlertChecks(tenantId, data.employee_id).catch(console.error);

    return event as unknown as ClockEvent;
  }

  async getClockEvents(tenantId: string, employeeId: string, dateFrom: string, dateTo: string): Promise<ClockEvent[]> {
    const { data, error } = await supabase
      .from('clock_events' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .gte('timestamp', dateFrom)
      .lte('timestamp', dateTo)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return (data || []) as unknown as ClockEvent[];
  }

  async adjustClock(eventId: string, newTimestamp: string, reason: string, adjustedBy: string): Promise<ClockEvent> {
    const { data, error } = await supabase
      .from('clock_events' as any)
      .update({
        timestamp: newTimestamp,
        is_adjusted: true,
        adjusted_from: newTimestamp, // will be set via trigger ideally
        adjustment_reason: reason,
        approved_by: adjustedBy,
      })
      .eq('id', eventId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ClockEvent;
  }

  // ── Daily Summaries ──

  async computeDailySummary(tenantId: string, employeeId: string, date: string): Promise<DailySummary> {
    const dayStart = `${date}T00:00:00Z`;
    const dayEnd = `${date}T23:59:59Z`;

    const events = await this.getClockEvents(tenantId, employeeId, dayStart, dayEnd);
    const rules = await this.getEffectiveRules(tenantId);

    const jornada = (rules.jornada_diaria?.minutes as number) ?? 480;
    const tolerance = (rules.jornada_diaria?.tolerance_minutes as number) ?? 10;
    const nightStart = (rules.adicional_noturno?.start_hour as number) ?? 22;
    const nightEnd = (rules.adicional_noturno?.end_hour as number) ?? 5;

    let totalWorked = 0;
    let breakMinutes = 0;
    let nocturnalMinutes = 0;
    let firstIn: string | null = null;
    let lastOut: string | null = null;

    // Pair clock_in/clock_out and break_start/break_end
    const clockIns = events.filter(e => e.event_type === 'clock_in');
    const clockOuts = events.filter(e => e.event_type === 'clock_out');
    const breakStarts = events.filter(e => e.event_type === 'break_start');
    const breakEnds = events.filter(e => e.event_type === 'break_end');

    if (clockIns.length > 0) firstIn = clockIns[0].timestamp;
    if (clockOuts.length > 0) lastOut = clockOuts[clockOuts.length - 1].timestamp;

    // Calculate worked time from in/out pairs
    for (let i = 0; i < Math.min(clockIns.length, clockOuts.length); i++) {
      const inTime = new Date(clockIns[i].timestamp).getTime();
      const outTime = new Date(clockOuts[i].timestamp).getTime();
      totalWorked += (outTime - inTime) / 60000;

      // Calculate nocturnal minutes within this pair
      nocturnalMinutes += this.computeNocturnalMinutes(
        new Date(clockIns[i].timestamp), new Date(clockOuts[i].timestamp), nightStart, nightEnd
      );
    }

    // Calculate break time
    for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
      const start = new Date(breakStarts[i].timestamp).getTime();
      const end = new Date(breakEnds[i].timestamp).getTime();
      breakMinutes += (end - start) / 60000;
    }

    const netWorked = Math.max(0, Math.round(totalWorked - breakMinutes));
    const overtime = Math.max(0, netWorked - jornada - tolerance);
    const deficit = Math.max(0, jornada - netWorked - tolerance);

    // Determine status
    let status: AttendanceStatus = 'present';
    if (events.length === 0) {
      status = 'absent';
    } else if (firstIn) {
      const scheduledStart = new Date(`${date}T08:00:00Z`); // configurable
      const actualStart = new Date(firstIn);
      const lateMinutes = (actualStart.getTime() - scheduledStart.getTime()) / 60000;
      if (lateMinutes > tolerance) status = 'late';
    }

    // Determine overtime type
    let overtimeType: OvertimeType | null = null;
    if (overtime > 0) {
      if (nocturnalMinutes > 0) overtimeType = 'nocturnal';
      else overtimeType = 'regular_50';
    }

    // Upsert summary
    const summaryData = {
      tenant_id: tenantId,
      employee_id: employeeId,
      date,
      status,
      first_clock_in: firstIn,
      last_clock_out: lastOut,
      total_worked_minutes: netWorked,
      break_minutes: Math.round(breakMinutes),
      overtime_minutes: overtime,
      overtime_type: overtimeType,
      is_nocturnal: nocturnalMinutes > 0,
      nocturnal_minutes: Math.round(nocturnalMinutes),
      deficit_minutes: deficit,
      expected_minutes: jornada,
    };

    const { data: existingRaw } = await supabase
      .from('time_daily_summaries' as any)
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();

    const existingRecord = existingRaw as any;
    let result;
    if (existingRecord?.id) {
      const { data: updated, error } = await supabase
        .from('time_daily_summaries' as any)
        .update(summaryData)
        .eq('id', existingRecord.id)
        .select()
        .single();
      if (error) throw error;
      result = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('time_daily_summaries' as any)
        .insert(summaryData)
        .select()
        .single();
      if (error) throw error;
      result = inserted;
    }

    // Auto-credit time bank if enabled
    const bankRules = rules.banco_horas;
    if (bankRules?.enabled && overtime > 0) {
      await this.creditTimeBank(tenantId, employeeId, overtime, date, (result as any).id);
    }

    return result as unknown as DailySummary;
  }

  async getDailySummaries(tenantId: string, employeeId: string, dateFrom: string, dateTo: string): Promise<DailySummary[]> {
    const { data, error } = await supabase
      .from('time_daily_summaries' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as DailySummary[];
  }

  // ── Time Bank (Banco de Horas) ──

  async creditTimeBank(tenantId: string, employeeId: string, minutes: number, refDate: string, summaryId?: string): Promise<TimeBankEntry> {
    const rules = await this.getEffectiveRules(tenantId);
    const expiryMonths = (rules.banco_horas?.expiry_months as number) ?? 6;

    const expiresAt = new Date(refDate);
    expiresAt.setMonth(expiresAt.getMonth() + expiryMonths);

    const { data, error } = await supabase
      .from('time_bank_entries' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        entry_type: 'credit',
        minutes,
        reference_date: refDate,
        source_summary_id: summaryId ?? null,
        reason: 'Horas extras creditadas automaticamente',
        expires_at: expiresAt.toISOString().split('T')[0],
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as TimeBankEntry;
  }

  async debitTimeBank(tenantId: string, employeeId: string, minutes: number, refDate: string, reason: string, createdBy?: string): Promise<TimeBankEntry> {
    const { data, error } = await supabase
      .from('time_bank_entries' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        entry_type: 'debit',
        minutes: -Math.abs(minutes),
        reference_date: refDate,
        reason,
        created_by: createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as TimeBankEntry;
  }

  async getTimeBankBalance(tenantId: string, employeeId: string): Promise<TimeBankBalance> {
    const today = new Date().toISOString().split('T')[0];

    const { data: entries, error } = await supabase
      .from('time_bank_entries' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('reference_date', { ascending: false });
    if (error) throw error;

    const all = (entries || []) as unknown as TimeBankEntry[];
    const active = all.filter(e => !e.expires_at || e.expires_at >= today);

    const credits = active.filter(e => e.entry_type === 'credit').reduce((s, e) => s + e.minutes, 0);
    const debits = active.filter(e => e.entry_type === 'debit').reduce((s, e) => s + Math.abs(e.minutes), 0);

    // Expiring within 30 days
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const expiringThreshold = thirtyDays.toISOString().split('T')[0];
    const expiringSoon = active
      .filter(e => e.entry_type === 'credit' && e.expires_at && e.expires_at <= expiringThreshold)
      .reduce((s, e) => s + e.minutes, 0);

    return {
      employee_id: employeeId,
      balance_minutes: credits - debits,
      credit_minutes: credits,
      debit_minutes: debits,
      expiring_soon_minutes: expiringSoon,
      entries_count: all.length,
    };
  }

  // ── Configurable Rules ──

  async getEffectiveRules(tenantId: string): Promise<Record<string, Record<string, unknown>>> {
    const { data, error } = await supabase
      .from('time_tracking_rules' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw error;

    // Start with defaults, overlay tenant overrides
    const result: Record<string, Record<string, unknown>> = {};
    for (const [key, def] of Object.entries(DEFAULT_TIME_RULES)) {
      result[key] = { ...def.value };
    }
    for (const rule of (data || []) as unknown as TimeTrackingRule[]) {
      result[rule.rule_key] = { ...result[rule.rule_key], ...rule.rule_value };
    }
    return result;
  }

  async upsertRule(tenantId: string, ruleKey: string, ruleValue: Record<string, unknown>, description?: string): Promise<TimeTrackingRule> {
    const { data: existingRuleRaw } = await supabase
      .from('time_tracking_rules' as any)
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('rule_key', ruleKey)
      .maybeSingle();

    const existingRule = existingRuleRaw as any;
    if (existingRule?.id) {
      const { data, error } = await supabase
        .from('time_tracking_rules' as any)
        .update({ rule_value: ruleValue, description })
        .eq('id', existingRule.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TimeTrackingRule;
    }

    const { data, error } = await supabase
      .from('time_tracking_rules' as any)
      .insert({ tenant_id: tenantId, rule_key: ruleKey, rule_value: ruleValue, description })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as TimeTrackingRule;
  }

  async listRules(tenantId: string): Promise<TimeTrackingRule[]> {
    const { data, error } = await supabase
      .from('time_tracking_rules' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('rule_key');
    if (error) throw error;
    return (data || []) as unknown as TimeTrackingRule[];
  }

  // ── Automatic Alerts ──

  async runAlertChecks(tenantId: string, employeeId: string): Promise<TimeTrackingAlert[]> {
    const today = new Date().toISOString().split('T')[0];
    const rules = await this.getEffectiveRules(tenantId);
    const alertConfig = rules.alertas ?? {};
    const alerts: TimeTrackingAlert[] = [];

    // 1. Missing clock_out check
    const missingThreshold = (alertConfig.missing_clock_out_after_minutes as number) ?? 720;
    const recentEvents = await this.getClockEvents(
      tenantId, employeeId,
      new Date(Date.now() - missingThreshold * 60000).toISOString(),
      new Date().toISOString()
    );
    const lastEvent = recentEvents[recentEvents.length - 1];
    if (lastEvent && lastEvent.event_type === 'clock_in') {
      const elapsed = (Date.now() - new Date(lastEvent.timestamp).getTime()) / 60000;
      if (elapsed > missingThreshold) {
        const alert = await this.createAlert(tenantId, employeeId, {
          alert_type: 'missing_clock_out',
          severity: 'critical',
          message: `Clock-in sem clock-out há ${Math.round(elapsed / 60)}h. Verificar presença.`,
          reference_date: today,
          metadata: { elapsed_minutes: Math.round(elapsed) },
        });
        if (alert) alerts.push(alert);
      }
    }

    // 2. Consecutive overtime check
    const consecutiveDays = (alertConfig.consecutive_overtime_days as number) ?? 3;
    const summaries = await this.getDailySummaries(
      tenantId, employeeId,
      new Date(Date.now() - consecutiveDays * 86400000).toISOString().split('T')[0],
      today
    );
    const overtimeDays = summaries.filter(s => s.overtime_minutes > 0).length;
    if (overtimeDays >= consecutiveDays) {
      const alert = await this.createAlert(tenantId, employeeId, {
        alert_type: 'consecutive_overtime',
        severity: 'warning',
        message: `${overtimeDays} dias consecutivos com horas extras. Risco de exceder limite CLT Art. 59.`,
        reference_date: today,
        metadata: { consecutive_days: overtimeDays },
      });
      if (alert) alerts.push(alert);
    }

    // 3. Time bank expiring
    const bankBalance = await this.getTimeBankBalance(tenantId, employeeId);
    if (bankBalance.expiring_soon_minutes > 0) {
      const alert = await this.createAlert(tenantId, employeeId, {
        alert_type: 'bank_expiring',
        severity: 'warning',
        message: `${Math.round(bankBalance.expiring_soon_minutes / 60)}h no banco de horas expirando em 30 dias.`,
        reference_date: today,
        metadata: { expiring_minutes: bankBalance.expiring_soon_minutes },
      });
      if (alert) alerts.push(alert);
    }

    // 4. Missing break check
    const latestSummary = summaries[0];
    if (latestSummary && latestSummary.total_worked_minutes > 360 && latestSummary.break_minutes < 60) {
      const alert = await this.createAlert(tenantId, employeeId, {
        alert_type: 'missing_break',
        severity: 'critical',
        message: `Jornada >6h sem intervalo mínimo de 1h. Infração CLT Art. 71.`,
        reference_date: today,
        metadata: { worked: latestSummary.total_worked_minutes, break: latestSummary.break_minutes },
      });
      if (alert) alerts.push(alert);
    }

    return alerts;
  }

  private async createAlert(tenantId: string, employeeId: string, data: {
    alert_type: AlertType;
    severity: AlertSeverity;
    message: string;
    reference_date: string;
    metadata?: Record<string, unknown>;
  }): Promise<TimeTrackingAlert | null> {
    // Avoid duplicates: check if same alert already exists for this date
    const { data: existingAlertRaw } = await supabase
      .from('time_tracking_alerts' as any)
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('alert_type', data.alert_type)
      .eq('reference_date', data.reference_date)
      .eq('is_resolved', false)
      .maybeSingle();

    if ((existingAlertRaw as any)?.id) return null;

    const { data: alert, error } = await supabase
      .from('time_tracking_alerts' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        ...data,
        metadata: data.metadata ?? {},
      })
      .select()
      .single();
    if (error) throw error;
    return alert as unknown as TimeTrackingAlert;
  }

  async getAlerts(tenantId: string, opts?: {
    employee_id?: string;
    unresolved_only?: boolean;
    limit?: number;
  }): Promise<TimeTrackingAlert[]> {
    let q = supabase
      .from('time_tracking_alerts' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 100);

    if (opts?.employee_id) q = q.eq('employee_id', opts.employee_id);
    if (opts?.unresolved_only !== false) q = q.eq('is_resolved', false);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as TimeTrackingAlert[];
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const { error } = await supabase
      .from('time_tracking_alerts' as any)
      .update({ is_resolved: true, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) throw error;
  }

  // ── Metrics ──

  async getMetrics(tenantId: string): Promise<TimeTrackingMetrics> {
    const today = new Date().toISOString().split('T')[0];

    const { data: summaries } = await supabase
      .from('time_daily_summaries' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('date', today);

    const all = (summaries || []) as unknown as DailySummary[];
    const present = all.filter(s => s.status === 'present');
    const absent = all.filter(s => s.status === 'absent');
    const late = all.filter(s => s.status === 'late');
    const overtime = all.filter(s => s.overtime_minutes > 0);
    const avgWorked = all.length > 0
      ? Math.round(all.reduce((s, r) => s + r.total_worked_minutes, 0) / all.length)
      : 0;

    const { count: alertCount } = await supabase
      .from('time_tracking_alerts' as any)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_resolved', false);

    const { data: bankEntries } = await supabase
      .from('time_bank_entries' as any)
      .select('minutes, entry_type')
      .eq('tenant_id', tenantId);

    const bankBalance = ((bankEntries || []) as unknown as { minutes: number; entry_type: string }[])
      .reduce((s, e) => s + e.minutes, 0);

    return {
      total_employees: all.length,
      present_today: present.length,
      absent_today: absent.length,
      late_today: late.length,
      avg_worked_minutes: avgWorked,
      overtime_employees: overtime.length,
      unresolved_alerts: alertCount ?? 0,
      total_bank_balance_minutes: bankBalance,
    };
  }

  // ── Helpers ──

  private computeNocturnalMinutes(start: Date, end: Date, nightStart: number, nightEnd: number): number {
    let nocturnal = 0;
    const cursor = new Date(start);

    while (cursor < end) {
      const hour = cursor.getHours();
      const isNight = hour >= nightStart || hour < nightEnd;
      if (isNight) nocturnal++;
      cursor.setMinutes(cursor.getMinutes() + 1);
    }

    return nocturnal;
  }
}

// ── Singleton ──
let _instance: TimeTrackingService | null = null;
export function getTimeTrackingService(): TimeTrackingService {
  if (!_instance) _instance = new TimeTrackingService();
  return _instance;
}
