/**
 * WorkTime Compliance Engine — DeviceIntegrityValidator
 * Manages trusted device registry and validates clock device identity.
 */

import { supabase } from '@/integrations/supabase/client';
import type { WorkTimeDevice, DeviceValidationResult, DeviceIntegrityValidatorAPI } from './types';

export class DeviceIntegrityValidator implements DeviceIntegrityValidatorAPI {

  async validate(tenantId: string, employeeId: string, fingerprint: string): Promise<DeviceValidationResult> {
    const { data, error } = await supabase
      .from('worktime_devices' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('device_fingerprint', fingerprint)
      .maybeSingle();

    if (error) throw error;

    const device = data as unknown as WorkTimeDevice | null;
    const riskFlags: string[] = [];

    if (!device) {
      riskFlags.push('unknown_device');
      // Auto-register new device
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

      return {
        is_valid: true,
        device: newDev as unknown as WorkTimeDevice,
        is_trusted: false,
        is_blocked: false,
        is_new: true,
        risk_flags: riskFlags,
      };
    }

    if (device.is_blocked) {
      riskFlags.push('blocked_device');
      return { is_valid: false, device, is_trusted: false, is_blocked: true, is_new: false, risk_flags: riskFlags };
    }

    if (!device.is_trusted) {
      riskFlags.push('untrusted_device');
    }

    // Update last_used_at
    await supabase
      .from('worktime_devices' as any)
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', device.id);

    return {
      is_valid: true,
      device,
      is_trusted: device.is_trusted,
      is_blocked: false,
      is_new: false,
      risk_flags: riskFlags,
    };
  }

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
