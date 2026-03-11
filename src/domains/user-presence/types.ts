/**
 * User Presence & Login Intelligence — Type Definitions
 *
 * UserSession model maps to the `user_sessions` DB table:
 *   session_id   → id
 *   login_time   → login_at
 *   session_status → status
 */

/** Canonical UserSession model as specified by the domain. */
export interface UserSession {
  session_id: string;
  user_id: string;
  tenant_id: string | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  login_time: string;
  last_activity: string;
  session_status: 'online' | 'idle' | 'offline' | 'expired';
}

/** Convert a raw DB row to the canonical UserSession model. */
export function toUserSession(row: ActiveSession): UserSession {
  return {
    session_id: row.id,
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    ip_address: row.ip_address,
    browser: row.browser,
    os: row.os,
    device_type: row.device_type,
    country: row.country,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    login_time: row.login_at,
    last_activity: row.last_activity,
    session_status: row.status,
  };
}
export interface ActiveSession {
  id: string;
  tenant_id: string | null;
  user_id: string;
  session_token: string;
  login_at: string;
  last_activity: string;
  logout_at: string | null;
  ip_address: string | null;
  ipv6: string | null;
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
  status: 'online' | 'idle' | 'offline' | 'expired';
}

export interface PresenceSummary {
  total_online: number;
  total_idle: number;
  total_today: number;
  unique_countries: number;
  unique_cities: number;
  mobile_pct: number;
  vpn_pct: number;
  browser_breakdown: Record<string, number>;
  os_breakdown: Record<string, number>;
  device_breakdown: Record<string, number>;
  login_method_breakdown: Record<string, number>;
  geo_clusters: GeoCluster[];
}

export interface GeoCluster {
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  count: number;
  sessions: ActiveSession[];
}

export interface LoginAnalytics {
  logins_last_1h: number;
  logins_last_24h: number;
  logins_last_7d: number;
  avg_session_duration_min: number;
  peak_hour: number;
  sso_pct: number;
  unique_ips_24h: number;
  suspicious_sessions: ActiveSession[];
}
