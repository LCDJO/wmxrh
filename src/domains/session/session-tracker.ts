/**
 * SessionTracker — Captures device, browser, geolocation and IP data
 * on login and records it in the user_sessions table.
 *
 * Geolocation strategy:
 *   1. navigator.geolocation.getCurrentPosition() (if user authorizes)
 *   2. IP-based geolocation fallback (via free API)
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

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

  // Browser detection
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

  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';

  // Device type
  if (/iPad|Tablet/i.test(ua)) device_type = 'tablet';
  else if (is_mobile) device_type = 'mobile';

  return { browser, browser_version, os, device_type, is_mobile, user_agent: ua };
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
}

/** Strategy 1: Browser geolocation API */
function getBrowserGeolocation(): Promise<GeoData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null), // denied or error → fallback
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

/** Strategy 2: IP-based geolocation fallback (free API) */
async function getIpGeolocation(): Promise<GeoData> {
  const fallback: GeoData = {
    latitude: null,
    longitude: null,
    ip_address: undefined,
    country: undefined,
    state: undefined,
    city: undefined,
  };

  try {
    // Using ip-api.com (free, no key needed, 45 req/min)
    const res = await fetch('http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,proxy,hosting,query', {
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
    };
  } catch {
    return fallback;
  }
}

// ════════════════════════════════════
// SESSION LIFECYCLE
// ════════════════════════════════════

let activeSessionId: string | null = null;
let activityInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Create a new session record on login.
 * Called from AuthContext after successful signIn.
 */
export async function startSession(
  userId: string,
  tenantId?: string | null,
  loginMethod: string = 'password',
  ssoProvider?: string | null
): Promise<string | null> {
  try {
    const device = detectDevice();

    // Geolocation: try browser first, fallback to IP
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
    };

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
      } as any)
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create user session', { error: error.message });
      return null;
    }

    activeSessionId = data?.id ?? null;
    logger.info('Session started', { sessionId: activeSessionId, browser: device.browser, city: geo.city });

    // Start heartbeat (update last_activity every 60s)
    startHeartbeat();

    return activeSessionId;
  } catch (err: any) {
    logger.error('Session start error', { error: err.message });
    return null;
  }
}

/**
 * End the current session (on signOut or tab close).
 */
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
// HEARTBEAT (last_activity + status)
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
  }, 60_000); // every 60s
}

function stopHeartbeat() {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
}

/** Best-effort PATCH to mark session offline (used on tab/browser close) */
function patchSessionOffline() {
  if (!activeSessionId) return;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${activeSessionId}`;
  const body = JSON.stringify({
    status: 'offline',
    logout_at: new Date().toISOString(),
  });
  try {
    fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* silent */ }
}

// Handle tab close / browser close
if (typeof window !== 'undefined') {
  // beforeunload — fires when tab/window is closing
  window.addEventListener('beforeunload', () => {
    patchSessionOffline();
    stopHeartbeat();
  });

  // pagehide — more reliable on mobile browsers
  window.addEventListener('pagehide', () => {
    patchSessionOffline();
    stopHeartbeat();
  });

  // visibilitychange — mark idle when tab is hidden, online when visible
  document.addEventListener('visibilitychange', () => {
    if (!activeSessionId) return;
    if (document.visibilityState === 'hidden') {
      // Mark as idle after tab is hidden
      supabase
        .from('user_sessions')
        .update({ status: 'idle', last_activity: new Date().toISOString() } as any)
        .eq('id', activeSessionId)
        .then(() => {});
    } else if (document.visibilityState === 'visible') {
      // Back to online when tab is focused again
      supabase
        .from('user_sessions')
        .update({ status: 'online', last_activity: new Date().toISOString() } as any)
        .eq('id', activeSessionId)
        .then(() => {});
    }
  });
}

/** Expose active session ID for other modules */
export function getActiveSessionId(): string | null {
  return activeSessionId;
}
