/**
 * SessionTracker — Frontend client for Session Service edge function.
 * 
 * Architecture:
 *   Browser → Session Service (Edge Function) → PostgreSQL + PostGIS
 * 
 * The frontend is responsible for:
 *   1. Detecting device/browser info (client-side only)
 *   2. Requesting browser geolocation (MUST be called within user gesture)
 *   3. Sending data to the Session Service for server-side IP + geo enrichment
 *   4. Maintaining heartbeat interval
 *   5. Closing session on logout/tab close via sendBeacon
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ════════════════════════════════════
// DEVICE / BROWSER DETECTION
// ════════════════════════════════════

export interface DeviceInfo {
  browser: string;
  browser_version: string;
  os: string;
  device_type: string;
  is_mobile: boolean;
  user_agent: string;
}

export function detectDevice(): DeviceInfo {
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

export interface BrowserGeo {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Request browser geolocation permission.
 * 
 * CRITICAL: Must be called WITHIN a user gesture handler (click/submit)
 * to satisfy browser security requirements. Do NOT call after await chains.
 */
export function requestGeolocation(): Promise<BrowserGeo | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (error) => {
        logger.info('Geolocation denied or failed', { code: error.code, message: error.message });
        resolve(null); // fallback to IP-based geo on server
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Capture all client-side data synchronously within user gesture context.
 * Call this at the TOP of your click/submit handler, BEFORE any await.
 */
export function captureClientContext(): { device: DeviceInfo; geoPromise: Promise<BrowserGeo | null> } {
  const device = detectDevice();
  const geoPromise = requestGeolocation(); // starts immediately in gesture context
  return { device, geoPromise };
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
 * 
 * @param userId - Authenticated user ID
 * @param tenantId - Resolved tenant ID (optional)
 * @param loginMethod - 'password' | 'sso' | etc
 * @param ssoProvider - SSO provider name (optional)
 * @param clientContext - Pre-captured device + geo from captureClientContext()
 */
export async function startSession(
  userId: string,
  tenantId?: string | null,
  loginMethod: string = 'password',
  ssoProvider?: string | null,
  clientContext?: { device: DeviceInfo; geoPromise: Promise<BrowserGeo | null> }
): Promise<string | null> {
  try {
    // Use pre-captured context or capture now (less reliable outside gesture)
    const device = clientContext?.device ?? detectDevice();
    const browserGeo = clientContext ? await clientContext.geoPromise : null;

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
      // Browser geolocation (if authorized by user)
      latitude: browserGeo?.latitude ?? null,
      longitude: browserGeo?.longitude ?? null,
    });

    activeSessionId = result?.session_id ?? null;

    logger.info('Session started via service', {
      sessionId: activeSessionId,
      browser: device.browser,
      geo: result?.geo,
      hasUserGeo: !!browserGeo,
    });

    startHeartbeat();

    // Auto-emit login event
    if (activeSessionId) {
      callSessionService('log_event', {
        session_id: activeSessionId,
        event_type: 'login',
        event_data: { browser: device.browser, os: device.os, device_type: device.device_type },
      }).catch(() => {});
    }

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
    // Auto-emit logout event before ending
    await callSessionService('log_event', {
      session_id: activeSessionId,
      event_type: 'logout',
      event_data: {},
    }).catch(() => {});

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
// TAB CLOSE HANDLER (sendBeacon)
// ════════════════════════════════════

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (activeSessionId) {
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
