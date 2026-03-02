/**
 * WorkTime Compliance Engine — DeviceIntegrityValidator
 *
 * Validates device integrity signals at clock time:
 *   - Root / Jailbreak detection
 *   - Mock location detection
 *   - VPN detection
 *   - IP ↔ Geolocation divergence
 *
 * Risk scoring: each flag adds weight; cumulative score determines action.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  WorkTimeDevice, DeviceValidationResult, DeviceIntegrityValidatorAPI,
  DeviceIntegritySignals, DeviceRiskFlag,
} from './types';

/** Risk weight per flag (sum → risk_score 0–100) */
const RISK_WEIGHTS: Record<DeviceRiskFlag, number> = {
  unknown_device: 10,
  untrusted_device: 5,
  blocked_device: 100,
  root_jailbreak: 40,
  mock_location: 50,
  vpn_detected: 20,
  ip_geo_mismatch: 30,
};

const FLAG_THRESHOLD = 25; // risk_score >= this → should_flag = true

export class DeviceIntegrityValidator implements DeviceIntegrityValidatorAPI {

  async validate(
    tenantId: string,
    employeeId: string,
    fingerprint: string,
    signals?: DeviceIntegritySignals,
  ): Promise<DeviceValidationResult> {
    const { data, error } = await supabase
      .from('worktime_devices' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('device_fingerprint', fingerprint)
      .maybeSingle();

    if (error) throw error;

    const device = data as unknown as WorkTimeDevice | null;
    const riskFlags: DeviceRiskFlag[] = [];

    // ── New / unknown device ──
    if (!device) {
      riskFlags.push('unknown_device');

      const { data: newDev, error: insertErr } = await supabase
        .from('worktime_devices' as any)
        .insert({
          tenant_id: tenantId,
          employee_id: employeeId,
          device_fingerprint: fingerprint,
          last_used_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // Run integrity checks on new device too
      this.checkIntegritySignals(signals, riskFlags);
      const riskScore = this.computeRiskScore(riskFlags);

      return {
        is_valid: true,
        device: newDev as unknown as WorkTimeDevice,
        is_trusted: false,
        is_blocked: false,
        is_new: true,
        risk_flags: riskFlags,
        risk_score: riskScore,
        should_flag: riskScore >= FLAG_THRESHOLD,
      };
    }

    // ── Blocked device ──
    if (device.is_blocked) {
      riskFlags.push('blocked_device');
      return {
        is_valid: false,
        device,
        is_trusted: false,
        is_blocked: true,
        is_new: false,
        risk_flags: riskFlags,
        risk_score: 100,
        should_flag: true,
      };
    }

    if (!device.is_trusted) {
      riskFlags.push('untrusted_device');
    }

    // ── Integrity signal checks ──
    this.checkIntegritySignals(signals, riskFlags);

    // Update last_used_at
    await supabase
      .from('worktime_devices' as any)
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', device.id);

    const riskScore = this.computeRiskScore(riskFlags);

    return {
      is_valid: riskScore < 100,
      device,
      is_trusted: device.is_trusted,
      is_blocked: false,
      is_new: false,
      risk_flags: riskFlags,
      risk_score: riskScore,
      should_flag: riskScore >= FLAG_THRESHOLD,
    };
  }

  // ── Integrity signal analysis ──

  private checkIntegritySignals(signals: DeviceIntegritySignals | undefined, flags: DeviceRiskFlag[]): void {
    if (!signals) return;

    // 1. Root / Jailbreak
    if (signals.is_rooted) {
      flags.push('root_jailbreak');
    }

    // 2. Mock location
    if (signals.is_mock_location) {
      flags.push('mock_location');
    }

    // 3. VPN active
    if (signals.is_vpn_active) {
      flags.push('vpn_detected');
    }

    // 4. IP ↔ GPS divergence (heuristic: if VPN + coordinates provided, flag)
    //    Full IP-to-geo resolution would require a server-side lookup (MaxMind, etc.)
    //    For now we flag when VPN is active AND coordinates are provided,
    //    since VPN masks the real IP making IP-geo correlation unreliable.
    if (signals.is_vpn_active && signals.latitude != null && signals.longitude != null) {
      flags.push('ip_geo_mismatch');
    }
  }

  private computeRiskScore(flags: DeviceRiskFlag[]): number {
    const raw = flags.reduce((sum, f) => sum + (RISK_WEIGHTS[f] ?? 0), 0);
    return Math.min(raw, 100);
  }

  // ── CRUD ──

  async listDevices(tenantId: string, employeeId: string): Promise<WorkTimeDevice[]> {
    const { data, error } = await supabase
      .from('worktime_devices' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as WorkTimeDevice[];
  }

  async trustDevice(deviceId: string, trustedBy: string): Promise<WorkTimeDevice> {
    const { data, error } = await supabase
      .from('worktime_devices' as any)
      .update({ is_trusted: true, trusted_at: new Date().toISOString(), trusted_by: trustedBy })
      .eq('id', deviceId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WorkTimeDevice;
  }

  async blockDevice(deviceId: string, reason: string): Promise<WorkTimeDevice> {
    const { data, error } = await supabase
      .from('worktime_devices' as any)
      .update({ is_blocked: true, blocked_reason: reason })
      .eq('id', deviceId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WorkTimeDevice;
  }
}
