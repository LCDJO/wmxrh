/**
 * useActiveSessions — Realtime hook for platform-level session monitoring.
 * Fetches all sessions and subscribes to postgres_changes for live updates.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SessionRecord {
  id: string;
  tenant_id: string | null;
  user_id: string;
  session_token: string;
  login_at: string;
  last_activity: string;
  logout_at: string | null;
  ip_address: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  device_type: string | null;
  user_agent: string | null;
  login_method: string | null;
  sso_provider: string | null;
  is_mobile: boolean;
  is_vpn: boolean;
  is_proxy: boolean;
  session_duration: number | null;
  status: string;
  asn_name: string | null;
  bytes_uploaded: number | null;
  bytes_downloaded: number | null;
  // Joined
  tenant_name?: string;
  user_email?: string;
  user_full_name?: string;
}

export interface SessionStats {
  online: number;
  idle: number;
  total_today: number;
  unique_users: number;
  unique_tenants: number;
  vpn_sessions: number;
  mobile_sessions: number;
  desktop_sessions: number;
  countries: number;
  avg_duration_min: number;
}

export function useActiveSessions() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchSessions = useCallback(async () => {
    try {
      // Fetch recent sessions (last 24h) with tenant name
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*, tenants:tenant_id(name)')
        .gte('login_at', since)
        .order('login_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!mountedRef.current) return;

      const mapped = (data ?? []).map((row: any) => ({
        ...row,
        tenant_name: row.tenants?.name ?? null,
      }));

      setSessions(mapped);
    } catch (err) {
      console.error('[useActiveSessions] fetch error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSessions();

    // Realtime subscription
    const channel = supabase
      .channel('user-activity-intelligence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_sessions',
      }, () => {
        // Re-fetch on any change for simplicity
        fetchSessions();
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchSessions]);

  // Compute stats
  const stats: SessionStats = (() => {
    const online = sessions.filter(s => s.status === 'online').length;
    const idle = sessions.filter(s => s.status === 'idle').length;
    const uniqueUsers = new Set(sessions.map(s => s.user_id)).size;
    const uniqueTenants = new Set(sessions.filter(s => s.tenant_id).map(s => s.tenant_id)).size;
    const vpn = sessions.filter(s => s.is_vpn).length;
    const mobile = sessions.filter(s => s.is_mobile).length;
    const desktop = sessions.filter(s => s.device_type === 'desktop').length;
    const countries = new Set(sessions.filter(s => s.country).map(s => s.country)).size;
    const durations = sessions.filter(s => s.session_duration != null).map(s => s.session_duration!);
    const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length / 60 : 0;

    return {
      online,
      idle,
      total_today: sessions.length,
      unique_users: uniqueUsers,
      unique_tenants: uniqueTenants,
      vpn_sessions: vpn,
      mobile_sessions: mobile,
      desktop_sessions: desktop,
      countries,
      avg_duration_min: Math.round(avgDur * 10) / 10,
    };
  })();

  return { sessions, stats, loading, refresh: fetchSessions };
}
