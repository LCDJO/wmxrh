/**
 * SessionTracker — Frontend client for Session Service edge function.
 * 
 * Architecture:
 *   Browser → Session Service (Edge Function) → PostgreSQL + PostGIS
 * 
 * The frontend is responsible for:
 *   1. Detecting device/browser info (client-side only)
 *   2. Requesting browser geolocation (if user authorizes)
 *   3. Sending data to the Session Service for server-side IP + geo enrichment
 *   4. Maintaining heartbeat interval
 *   5. Closing session on logout/tab close via sendBeacon
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

// ════════════════════════════════════
// BROWSER GEOLOCATION
// ════════════════════════════════════

interface BrowserGeo {
  latitude: number;
  longitude: number;
  accuracy: number;
}

function getBrowserGeolocation(): Promise<BrowserGeo | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
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

// ════════════════════════════════════
// SESSION SERVICE CLIENT
// ════════════════════════════════════

async function callSessionService(action: string, payload: Record<string, any> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('session-service', {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}

// ════════════════════════════════════
// SESSION LIFECYCLE
// ════════════════════════════════════

let activeSessionId: string | null = null;
let activityInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Create a new session via Session Service edge function.
 * Server-side: extracts real IP, enriches geo, detects VPN/proxy.
 * Client-side: provides browser info + optional browser geolocation.
 */
export async function startSession(
  userId: string,
  tenantId?: string | null,
  loginMethod: string = 'password',
  ssoProvider?: string | null
): Promise<string | null> {
  try {
    const device = detectDevice();
    const browserGeo = await getBrowserGeolocation();

    const result = await callSessionService('start', {
      tenant_id: tenantId ?? null,
      login_method: loginMethod,
      sso_provider: ssoProvider ?? null,
      // Device info (client-only)
      browser: device.browser,
      browser_version: device.browser_version,
      os: device.os,
      device_type: device.device_type,
      user_agent: device.user_agent,
      is_mobile: device.is_mobile,
      // Browser geolocation (if authorized)
      latitude: browserGeo?.latitude ?? null,
      longitude: browserGeo?.longitude ?? null,
    });

    activeSessionId = result?.session_id ?? null;

    logger.info('Session started via service', {
      sessionId: activeSessionId,
      browser: device.browser,
      geo: result?.geo,
    });

    startHeartbeat();
    return activeSessionId;
  } catch (err: any) {
    logger.error('Session start error', { error: err.message });
    return null;
  }
}

/**
 * End the current session via Session Service.
 */
export async function endSession(): Promise<void> {
  stopHeartbeat();
  if (!activeSessionId) return;

  try {
    const result = await callSessionService('end', { session_id: activeSessionId });
    logger.info('Session ended via service', { sessionId: activeSessionId, duration: result?.duration });
    activeSessionId = null;
  } catch (err: any) {
    logger.error('Session end error', { error: err.message });
  }
}

// ════════════════════════════════════
// HEARTBEAT
// ════════════════════════════════════

function startHeartbeat() {
  stopHeartbeat();
  activityInterval = setInterval(async () => {
    if (!activeSessionId) return;
    try {
      await callSessionService('heartbeat', { session_id: activeSessionId });
    } catch { /* silent */ }
  }, 60_000);
}

function stopHeartbeat() {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
}

// ════════════════════════════════════
// TAB CLOSE HANDLER (sendBeacon fallback)
// ════════════════════════════════════

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (activeSessionId) {
      // sendBeacon to edge function for reliable close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/session-service`;
      const body = JSON.stringify({
        action: 'end',
        session_id: activeSessionId,
      });
      navigator.sendBeacon?.(url, body);
    }
    stopHeartbeat();
  });
}

/** Expose active session ID for other modules */
export function getActiveSessionId(): string | null {
  return activeSessionId;
}
