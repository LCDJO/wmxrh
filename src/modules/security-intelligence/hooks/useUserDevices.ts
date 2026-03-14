/**
 * useUserDevices — Hook for user_devices table.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserDeviceRecord {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_name: string | null;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  device_type: string | null;
  first_seen: string;
  last_seen: string;
  trusted: boolean;
  trusted_at: string | null;
  trusted_by: string | null;
  login_count: number;
  ip_addresses: string[];
  countries: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useUserDevices() {
  const [devices, setDevices] = useState<UserDeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    const { data } = await supabase
      .from('user_devices')
      .select('*')
      .order('last_seen', { ascending: false })
      .limit(500);
    setDevices((data as unknown as UserDeviceRecord[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return { devices, loading, refresh: fetchDevices };
}
