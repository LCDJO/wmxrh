/**
 * UserPresenceEngine — Core engine for querying active sessions,
 * computing presence summaries, and login analytics.
 */

import { supabase } from '@/integrations/supabase/client';
import type { ActiveSession, PresenceSummary, GeoCluster, LoginAnalytics } from './types';

// ════════════════════════════════════════════════
// SESSION QUERIES
// ════════════════════════════════════════════════

export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .in('status', ['online', 'idle'])
    .order('last_activity', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[PresenceEngine] fetch active sessions error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ActiveSession[];
}

export async function fetchRecentSessions(hours = 24): Promise<ActiveSession[]> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .gte('login_at', since)
    .order('login_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('[PresenceEngine] fetch recent sessions error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ActiveSession[];
}

// ════════════════════════════════════════════════
// PRESENCE SUMMARY
// ════════════════════════════════════════════════

export function computePresenceSummary(
  activeSessions: ActiveSession[],
  recentSessions: ActiveSession[]
): PresenceSummary {
  const online = activeSessions.filter(s => s.status === 'online');
  const idle = activeSessions.filter(s => s.status === 'idle');

  const countries = new Set(activeSessions.map(s => s.country).filter(Boolean));
  const cities = new Set(activeSessions.map(s => s.city).filter(Boolean));

  const mobileCount = activeSessions.filter(s => s.is_mobile).length;
  const vpnCount = activeSessions.filter(s => s.is_vpn).length;
  const total = activeSessions.length || 1;

  const browserBreakdown = breakdown(activeSessions, 'browser');
  const osBreakdown = breakdown(activeSessions, 'os');
  const deviceBreakdown = breakdown(activeSessions, 'device_type');
  const loginMethodBreakdown = breakdown(recentSessions, 'login_method');

  return {
    total_online: online.length,
    total_idle: idle.length,
    total_today: recentSessions.length,
    unique_countries: countries.size,
    unique_cities: cities.size,
    mobile_pct: Math.round((mobileCount / total) * 100),
    vpn_pct: Math.round((vpnCount / total) * 100),
    browser_breakdown: browserBreakdown,
    os_breakdown: osBreakdown,
    device_breakdown: deviceBreakdown,
    login_method_breakdown: loginMethodBreakdown,
    geo_clusters: computeGeoClusters(activeSessions),
  };
}

// ════════════════════════════════════════════════
// LOGIN ANALYTICS
// ════════════════════════════════════════════════

export function computeLoginAnalytics(recentSessions: ActiveSession[]): LoginAnalytics {
  const now = Date.now();
  const h1 = now - 3600_000;
  const h24 = now - 86400_000;
  const d7 = now - 7 * 86400_000;

  const last1h = recentSessions.filter(s => new Date(s.login_at).getTime() >= h1);
  const last24h = recentSessions.filter(s => new Date(s.login_at).getTime() >= h24);
  const last7d = recentSessions.filter(s => new Date(s.login_at).getTime() >= d7);

  const durations = recentSessions
    .map(s => s.session_duration)
    .filter((d): d is number => d !== null && d > 0);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
    : 0;

  // Peak hour
  const hourCounts = new Array(24).fill(0);
  last24h.forEach(s => {
    const h = new Date(s.login_at).getHours();
    hourCounts[h]++;
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  const ssoCount = recentSessions.filter(s => s.login_method === 'sso').length;
  const uniqueIps = new Set(last24h.map(s => s.ip_address).filter(Boolean));

  const suspicious = recentSessions.filter(s => s.is_vpn || s.is_proxy);

  return {
    logins_last_1h: last1h.length,
    logins_last_24h: last24h.length,
    logins_last_7d: last7d.length,
    avg_session_duration_min: avgDuration,
    peak_hour: peakHour,
    sso_pct: recentSessions.length > 0 ? Math.round((ssoCount / recentSessions.length) * 100) : 0,
    unique_ips_24h: uniqueIps.size,
    suspicious_sessions: suspicious.slice(0, 20),
  };
}

// ════════════════════════════════════════════════
// GEO CLUSTERING
// ════════════════════════════════════════════════

function computeGeoClusters(sessions: ActiveSession[]): GeoCluster[] {
  const geoSessions = sessions.filter(s => s.latitude !== null && s.longitude !== null);
  const clusterMap = new Map<string, GeoCluster>();

  for (const s of geoSessions) {
    // Cluster by city+country
    const key = `${s.city ?? 'unknown'}|${s.country ?? 'unknown'}`;
    const existing = clusterMap.get(key);
    if (existing) {
      existing.count++;
      existing.sessions.push(s);
    } else {
      clusterMap.set(key, {
        latitude: s.latitude!,
        longitude: s.longitude!,
        city: s.city,
        country: s.country,
        count: 1,
        sessions: [s],
      });
    }
  }

  return Array.from(clusterMap.values()).sort((a, b) => b.count - a.count);
}

// ════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════

function breakdown(sessions: ActiveSession[], field: keyof ActiveSession): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of sessions) {
    const val = String(s[field] ?? 'Unknown');
    map[val] = (map[val] ?? 0) + 1;
  }
  return map;
}
