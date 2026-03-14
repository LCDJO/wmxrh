/**
 * SessionTracker — Captures device, browser, geolocation and IP data
 * on login and records it in the user_sessions table.
 *
 * Enhanced with:
 *  - Risk scoring (calculated on login)
 *  - Device fingerprinting
 *  - Session event emission
 *  - Visibility/idle tracking
 *  - Reliable session termination via fetch+keepalive
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { calculateRiskScore } from '@/modules/user-activity/engine/risk-scoring';

// ════════════════════════════════════
// DEVICE / BROWSER DETECTION
// ════════════════════════════════════

interface DeviceInfo {
  browser: string;
  browser_version: string;
  os: string;
  device_type: string;
  is_mobile: boolean;
  user_agent: string;
}

function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let browser_version = '';
  let os = 'Unknown';
  let device_type = 'desktop';
  const is_mobile = /Mobi|Android|iPhone|iPad/i.test(ua);

  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browser_version = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
    browser_version = ua.match(/Edg\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    browser = 'Chrome';
    browser_version = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
    browser_version = ua.match(/Version\/([\d.]+)/)?.[1] ?? '';
  }

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';

  if (/iPad|Tablet/i.test(ua)) device_type = 'tablet';
  else if (is_mobile) device_type = 'mobile';

  return { browser, browser_version, os, device_type, is_mobile, user_agent: ua };
}

/**
 * Simple device fingerprint based on available browser properties.
 */
function generateDeviceFingerprint(): string {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  const renderer = gl ? (gl.getExtension('WEBGL_debug_renderer_info')
    ? gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')!.UNMASKED_RENDERER_WEBGL)
    : 'unknown') : 'no-webgl';

  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency ?? 0,
    renderer,
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return 'fp_' + Math.abs(hash).toString(36);
}

// ════════════════════════════════════
// GEOLOCATION
// ════════════════════════════════════

interface GeoData {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number;
  ip_address?: string;
  ipv6?: string;
  country?: string;
  state?: string;
  city?: string;
  is_vpn?: boolean;
  is_proxy?: boolean;
  asn_name?: string;
}

function getBrowserGeolocation(): Promise<GeoData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

async function getIpGeolocation(): Promise<GeoData> {
  const fallback: GeoData = { latitude: null, longitude: null };
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('ipapi failed');
    const data = await res.json();
    return {
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      ip_address: data.ip ?? undefined,
      country: data.country_name ?? undefined,
      state: data.region ?? undefined,
      city: data.city ?? undefined,
      is_vpn: false,
      is_proxy: false,
      asn_name: data.org ?? undefined,
    };
  } catch {
    try {
      const res = await fetch('http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,proxy,hosting,query,isp', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      if (data.status !== 'success') return fallback;
      return {
        latitude: data.lat ?? null,
        longitude: data.lon ?? null,
        ip_address: data.query ?? undefined,
        country: data.country ?? undefined,
        state: data.regionName ?? undefined,
        city: data.city ?? undefined,
        is_vpn: data.proxy ?? false,
        is_proxy: data.hosting ?? false,
        asn_name: data.isp ?? undefined,
      };
    } catch { return fallback; }
  }
}

// ════════════════════════════════════
// SESSION LIFECYCLE
// ════════════════════════════════════

let activeSessionId: string | null = null;
let activityInterval: ReturnType<typeof setInterval> | null = null;

export async function startSession(
  userId: string,
  tenantId?: string | null,
  loginMethod: string = 'password',
  ssoProvider?: string | null
): Promise<string | null> {
  try {
    const device = detectDevice();
    const fingerprint = generateDeviceFingerprint();

    const [browserGeo, ipGeo] = await Promise.all([
      getBrowserGeolocation(),
      getIpGeolocation(),
    ]);

    const geo: GeoData = {
      latitude: browserGeo?.latitude ?? ipGeo.latitude,
      longitude: browserGeo?.longitude ?? ipGeo.longitude,
      ip_address: ipGeo.ip_address,
      country: ipGeo.country,
      state: ipGeo.state,
      city: ipGeo.city,
      is_vpn: ipGeo.is_vpn,
      is_proxy: ipGeo.is_proxy,
      asn_name: ipGeo.asn_name,
    };

    // Fetch recent sessions for risk scoring
    const { data: history } = await supabase
      .from('user_sessions')
      .select('ip_address, country, latitude, longitude, device_type, browser, login_at')
      .eq('user_id', userId)
      .order('login_at', { ascending: false })
      .limit(20);

    const riskResult = calculateRiskScore(
      {
        ip_address: geo.ip_address ?? null,
        country: geo.country ?? null,
        city: geo.city ?? null,
        latitude: geo.latitude,
        longitude: geo.longitude,
        is_vpn: geo.is_vpn ?? false,
        is_proxy: geo.is_proxy ?? false,
        device_type: device.device_type,
        browser: device.browser,
        os: device.os,
        user_agent: device.user_agent,
      },
      (history ?? []) as any[]
    );

    const sessionToken = crypto.randomUUID();

    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        tenant_id: tenantId ?? null,
        session_token: sessionToken,
        login_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        ip_address: geo.ip_address ?? null,
        country: geo.country ?? null,
        state: geo.state ?? null,
        city: geo.city ?? null,
        latitude: geo.latitude,
        longitude: geo.longitude,
        browser: device.browser,
        browser_version: device.browser_version,
        os: device.os,
        device_type: device.device_type,
        user_agent: device.user_agent,
        login_method: loginMethod,
        sso_provider: ssoProvider ?? null,
        is_mobile: device.is_mobile,
        is_vpn: geo.is_vpn ?? false,
        is_proxy: geo.is_proxy ?? false,
        status: 'online',
        asn_name: geo.asn_name ?? null,
        device_fingerprint: fingerprint,
        risk_score: riskResult.score,
        risk_factors: riskResult.factors,
        is_suspicious: riskResult.level === 'high_risk',
      } as any)
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create user session', { error: error.message });
      return null;
    }

    activeSessionId = data?.id ?? null;
    logger.info('Session started', {
      sessionId: activeSessionId,
      browser: device.browser,
      city: geo.city,
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
    });

    // Create security alert if high risk
    if (riskResult.level === 'high_risk' && activeSessionId) {
      await supabase.from('session_security_alerts').insert({
        session_id: activeSessionId,
        tenant_id: tenantId ?? null,
        user_id: userId,
        alert_type: 'high_risk_login',
        severity: 'high',
        title: `Login de alto risco (score: ${riskResult.score})`,
        description: riskResult.factors.map(f => f.description).join('; '),
        ip_address: geo.ip_address ?? null,
        location: [geo.city, geo.country].filter(Boolean).join(', '),
        risk_score: riskResult.score,
        metadata: { factors: riskResult.factors, device: device, fingerprint },
      } as any);
    }

    startHeartbeat();
    setupVisibilityTracking();

    return activeSessionId;
  } catch (err: any) {
    logger.error('Session start error', { error: err.message });
    return null;
  }
}

export async function endSession(): Promise<void> {
  stopHeartbeat();
  if (!activeSessionId) return;

  try {
    const loginAt = await getSessionLoginAt(activeSessionId);
    const duration = loginAt ? Math.floor((Date.now() - new Date(loginAt).getTime()) / 1000) : null;

    await supabase
      .from('user_sessions')
      .update({
        status: 'offline',
        logout_at: new Date().toISOString(),
        session_duration: duration,
      } as any)
      .eq('id', activeSessionId);

    logger.info('Session ended', { sessionId: activeSessionId, duration });
    activeSessionId = null;
  } catch (err: any) {
    logger.error('Session end error', { error: err.message });
  }
}

async function getSessionLoginAt(sessionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_sessions')
    .select('login_at')
    .eq('id', sessionId)
    .single();
  return (data as any)?.login_at ?? null;
}

// ════════════════════════════════════
// HEARTBEAT + VISIBILITY
// ════════════════════════════════════

function startHeartbeat() {
  stopHeartbeat();
  activityInterval = setInterval(async () => {
    if (!activeSessionId) return;
    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString(), status: 'online' } as any)
        .eq('id', activeSessionId);
    } catch { /* silent */ }
  }, 60_000);
}

function stopHeartbeat() {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
}

function setupVisibilityTracking() {
  document.addEventListener('visibilitychange', () => {
    if (!activeSessionId) return;
    const newStatus = document.hidden ? 'idle' : 'online';
    supabase
      .from('user_sessions')
      .update({ status: newStatus, last_activity: new Date().toISOString() } as any)
      .eq('id', activeSessionId)
      .then(() => {});
  });
}

// Handle tab close
if (typeof window !== 'undefined') {
  const closeHandler = () => {
    if (!activeSessionId) return;
    stopHeartbeat();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${activeSessionId}`;
    const body = JSON.stringify({ status: 'offline', logout_at: new Date().toISOString() });
    const headers = {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Prefer': 'return=minimal',
    };

    // Use fetch with keepalive for reliable delivery
    try {
      fetch(url, { method: 'PATCH', headers, body, keepalive: true });
    } catch { /* best effort */ }
  };

  window.addEventListener('beforeunload', closeHandler);
  window.addEventListener('pagehide', closeHandler);
}

export function getActiveSessionId(): string | null {
  return activeSessionId;
}
