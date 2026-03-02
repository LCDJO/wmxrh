/**
 * WorkforceOperationsEngine — Time Tracking Domain
 *
 * Manages employee clock-in/out, time banks, and attendance.
 * Integrates with GovernanceEventBus for audit trail.
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type ClockEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'holiday' | 'vacation';
export type OvertimeType = 'regular_50' | 'regular_100' | 'nocturnal' | 'holiday';

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
  created_at: string;
}

export interface DailySummary {
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number;
  break_hours: number;
  overtime_hours: number;
  overtime_type: OvertimeType | null;
  is_nocturnal: boolean;
}

export interface TimeBankBalance {
  employee_id: string;
  balance_hours: number;
  credit_hours: number;
  debit_hours: number;
  period_start: string;
  period_end: string;
}

export interface TimeTrackingMetrics {
  total_employees: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  avg_hours_today: number;
  overtime_employees: number;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

export class TimeTrackingService {
  async registerClock(tenantId: string, data: {
    employee_id: string;
    event_type: ClockEventType;
    source?: ClockEvent['source'];
    latitude?: number;
    longitude?: number;
    device_id?: string;
    notes?: string;
  }): Promise<ClockEvent> {
    // In-memory until DB table is created
    const event: ClockEvent = {
      id: `clk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenant_id: tenantId,
      employee_id: data.employee_id,
      event_type: data.event_type,
      timestamp: new Date().toISOString(),
      source: data.source ?? 'manual',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      device_id: data.device_id ?? null,
      notes: data.notes ?? null,
      approved_by: null,
      created_at: new Date().toISOString(),
    };
    return event;
  }

  async getDailySummary(tenantId: string, employeeId: string, date: string): Promise<DailySummary> {
    return {
      employee_id: employeeId,
      date,
      status: 'present',
      clock_in: null,
      clock_out: null,
      total_hours: 0,
      break_hours: 0,
      overtime_hours: 0,
      overtime_type: null,
      is_nocturnal: false,
    };
  }

  async getTimeBankBalance(tenantId: string, employeeId: string): Promise<TimeBankBalance> {
    return {
      employee_id: employeeId,
      balance_hours: 0,
      credit_hours: 0,
      debit_hours: 0,
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
    };
  }

  async getMetrics(tenantId: string): Promise<TimeTrackingMetrics> {
    return {
      total_employees: 0,
      present_today: 0,
      absent_today: 0,
      late_today: 0,
      avg_hours_today: 0,
      overtime_employees: 0,
    };
  }
}

let _instance: TimeTrackingService | null = null;
export function getTimeTrackingService(): TimeTrackingService {
  if (!_instance) _instance = new TimeTrackingService();
  return _instance;
}
