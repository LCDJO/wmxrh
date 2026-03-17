/**
 * useActiveSessions — Realtime hook for platform-level session monitoring.
 * Fetches active sessions and prepares geolocated map points with history fallback.
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
  source?: 'active' | 'history';
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
  const [mapSessions, setMapSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchSessions = useCallback(async () => {
    try {
      const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const historySince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [activeResponse, historyResponse] = await Promise.all([
        supabase
          .from('user_sessions')
          .select('*, tenants:tenant_id(name)')
          .gte('login_at', activeSince)
          .order('login_at', { ascending: false })
          .limit(500),
        supabase
          .from('session_history')
          .select('*')
          .gte('logout_at', historySince)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('logout_at', { ascending: false })
          .limit(150),
      ]);

      if (activeResponse.error) throw activeResponse.error;
      if (!mountedRef.current) return;

      const activeMapped = (activeResponse.data ?? []).map((row: any) => ({
        ...row,
        tenant_name: row.tenants?.name ?? null,
        source: 'active' as const,
      }));

      const historyMapped: SessionRecord[] = historyResponse.error
        ? []
        : (historyResponse.data ?? []).map((row: any) => ({
            id: `history-${row.id}`,
            tenant_id: row.tenant_id ?? null,
            user_id: row.user_id,
            session_token: row.session_id,
            login_at: row.login_at,
            last_activity: row.logout_at,
            logout_at: row.logout_at,
            ip_address: row.ip_address ?? null,
            country: row.country ?? null,
            state: row.state ?? null,
            city: row.city ?? null,
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
            browser: row.browser ?? null,
            browser_version: row.browser_version ?? null,
            os: row.os ?? null,
            device_type: row.device_type ?? null,
            user_agent: row.user_agent ?? null,
            login_method: row.login_method ?? null,
            sso_provider: null,
            is_mobile: row.is_mobile ?? false,
            is_vpn: row.is_vpn ?? false,
            is_proxy: row.is_proxy ?? false,
            session_duration: row.duration_seconds ?? null,
            status: 'offline',
            asn_name: row.asn_name ?? null,
            bytes_uploaded: null,
            bytes_downloaded: null,
            tenant_name: null,
            user_email: undefined,
            user_full_name: undefined,
            source: 'history',
          }));

      const activeGeoSessions = activeMapped.filter(
        (session) => session.latitude != null && session.longitude != null,
      );

      setSessions(activeMapped);
      setMapSessions(activeGeoSessions.length > 0 ? activeGeoSessions : historyMapped);

      if (historyResponse.error) {
        console.warn('[useActiveSessions] history fallback unavailable:', historyResponse.error);
      }
    } catch (err) {
      console.error('[useActiveSessions] fetch error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSessions();

    const channel = supabase
      .channel('user-activity-intelligence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_sessions',
      }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchSessions]);

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

  return { sessions, mapSessions, stats, loading, refresh: fetchSessions };
}
