/**
 * Security Intelligence Engine — Advanced risk analysis service.
 * 
 * Analyzes sessions against 6 detection rules:
 *  1. Impossible travel
 *  2. New country login
 *  3. New device (fingerprint)
 *  4. VPN/Proxy detection
 *  5. Multiple simultaneous sessions
 *  6. Unusual login time
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateRiskScore, type RiskResult } from '@/modules/user-activity/engine/risk-scoring';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface AnalysisResult {
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: RiskReason[];
  auto_action?: string;
}

export interface RiskReason {
  rule: string;
  points: number;
  description: string;
}

interface SessionData {
  id: string;
  user_id: string;
  tenant_id: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_vpn: boolean;
  is_proxy: boolean;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  login_at: string;
}

// ════════════════════════════════════
// HAVERSINE
// ════════════════════════════════════

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ════════════════════════════════════
// RULE ENGINE
// ════════════════════════════════════

async function ruleImpossibleTravel(session: SessionData, history: SessionData[]): Promise<RiskReason | null> {
  if (!session.latitude || !session.longitude) return null;

  const recentWithGeo = history
    .filter(h => h.latitude && h.longitude)
    .sort((a, b) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime());

  if (recentWithGeo.length === 0) return null;

  const last = recentWithGeo[0];
  const dist = haversineKm(session.latitude, session.longitude, last.latitude!, last.longitude!);
  const timeDiffMin = (new Date(session.login_at).getTime() - new Date(last.login_at).getTime()) / 60000;

  if (timeDiffMin <= 0 || timeDiffMin > 60) return null;

  if (dist > 4000) {
    return {
      rule: 'impossible_travel',
      points: 50,
      description: `Impossible travel detected: ${Math.round(dist)}km in ${Math.round(timeDiffMin)}min`,
    };
  }

  const speedKmH = dist / (timeDiffMin / 60);
  if (speedKmH > 900 && dist > 500) {
    return {
      rule: 'impossible_travel',
      points: 50,
      description: `Suspicious speed: ${Math.round(speedKmH)}km/h (${Math.round(dist)}km in ${Math.round(timeDiffMin)}min)`,
    };
  }

  return null;
}

function ruleNewCountry(session: SessionData, history: SessionData[]): RiskReason | null {
  if (!session.country) return null;
  const knownCountries = new Set(history.map(h => h.country).filter(Boolean));
  if (knownCountries.size > 0 && !knownCountries.has(session.country)) {
    return { rule: 'new_country', points: 30, description: `New country login: ${session.country}` };
  }
  return null;
}

function ruleNewDevice(session: SessionData, history: SessionData[]): RiskReason | null {
  if (!session.device_fingerprint) return null;
  const knownFingerprints = new Set(history.map(h => h.device_fingerprint).filter(Boolean));
  if (knownFingerprints.size > 0 && !knownFingerprints.has(session.device_fingerprint)) {
    return { rule: 'unknown_device', points: 20, description: `Unknown device: ${session.browser} (${session.device_type})` };
  }
  return null;
}

function ruleVpnProxy(session: SessionData): RiskReason | null {
  if (session.is_vpn) return { rule: 'vpn_detected', points: 30, description: 'VPN detected' };
  if (session.is_proxy) return { rule: 'proxy_detected', points: 20, description: 'Proxy detected' };
  return null;
}

async function ruleMultipleSessions(session: SessionData): Promise<RiskReason | null> {
  const { count } = await supabase
    .from('user_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user_id)
    .eq('status', 'online');

  if (count && count > 5) {
    return { rule: 'too_many_sessions', points: 20, description: `Too many sessions: ${count} concurrent sessions` };
  }
  return null;
}

function ruleUnusualTime(session: SessionData, history: SessionData[]): RiskReason | null {
  if (history.length < 5) return null;

  const currentHour = new Date(session.login_at).getHours();
  const historicalHours = history.map(h => new Date(h.login_at).getHours());
  
  // Calculate mean and standard deviation
  const mean = historicalHours.reduce((a, b) => a + b, 0) / historicalHours.length;
  const variance = historicalHours.reduce((sum, h) => sum + (h - mean) ** 2, 0) / historicalHours.length;
  const stdDev = Math.sqrt(variance);

  // If current hour is more than 2 standard deviations from mean
  if (Math.abs(currentHour - mean) > Math.max(stdDev * 2, 4)) {
    return { rule: 'unusual_login_time', points: 10, description: `Unusual login time: ${currentHour}:00 (typical: ~${Math.round(mean)}:00)` };
  }
  return null;
}

// ════════════════════════════════════
// MAIN ANALYSIS
// ════════════════════════════════════

export async function analyzeSession(sessionId: string): Promise<AnalysisResult> {
  // Fetch session
  const { data: session } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return { risk_score: 0, risk_level: 'LOW', reasons: [] };
  }

  const s = session as unknown as SessionData;

  // Fetch user history (last 50 sessions)
  const { data: history } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', s.user_id)
    .neq('id', sessionId)
    .order('login_at', { ascending: false })
    .limit(50);

  const h = (history ?? []) as unknown as SessionData[];

  // Run all rules
  const reasons: RiskReason[] = [];

  const [impossibleTravel, multipleSessions] = await Promise.all([
    ruleImpossibleTravel(s, h),
    ruleMultipleSessions(s),
  ]);

  if (impossibleTravel) reasons.push(impossibleTravel);
  if (multipleSessions) reasons.push(multipleSessions);

  const newCountry = ruleNewCountry(s, h);
  if (newCountry) reasons.push(newCountry);

  const newDevice = ruleNewDevice(s, h);
  if (newDevice) reasons.push(newDevice);

  const vpnProxy = ruleVpnProxy(s);
  if (vpnProxy) reasons.push(vpnProxy);

  const unusualTime = ruleUnusualTime(s, h);
  if (unusualTime) reasons.push(unusualTime);

  const risk_score = Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0));
  const risk_level: AnalysisResult['risk_level'] =
    risk_score >= 61 ? 'HIGH' : risk_score >= 31 ? 'MEDIUM' : 'LOW';

  // Determine auto action
  let auto_action: string | undefined;
  if (risk_score >= 60) {
    auto_action = 'block_session';
  }

  // Store analysis result
  await supabase.from('session_risk_analysis').insert({
    session_id: sessionId,
    tenant_id: s.tenant_id,
    user_id: s.user_id,
    risk_score,
    risk_level,
    reasons,
  } as any);

  // Create security alert if HIGH
  if (risk_level === 'HIGH') {
    await supabase.from('security_alerts').insert({
      tenant_id: s.tenant_id,
      user_id: s.user_id,
      session_id: sessionId,
      alert_type: 'high_risk_login',
      risk_score,
      risk_level,
      location: [s.city, s.country].filter(Boolean).join(', '),
      ip_address: s.ip_address,
      title: `High risk login (score: ${risk_score})`,
      description: reasons.map(r => r.description).join('; '),
      metadata: { reasons, device_fingerprint: s.device_fingerprint },
      auto_action_taken: auto_action ?? null,
    } as any);
  } else if (risk_level === 'MEDIUM') {
    await supabase.from('security_alerts').insert({
      tenant_id: s.tenant_id,
      user_id: s.user_id,
      session_id: sessionId,
      alert_type: 'medium_risk_login',
      risk_score,
      risk_level,
      location: [s.city, s.country].filter(Boolean).join(', '),
      ip_address: s.ip_address,
      title: `Attention: login with risk score ${risk_score}`,
      description: reasons.map(r => r.description).join('; '),
      metadata: { reasons },
    } as any);
  }

  // Register/update device
  if (s.device_fingerprint) {
    await registerDevice(s);
  }

  return { risk_score, risk_level, reasons, auto_action };
}

// ════════════════════════════════════
// DEVICE REGISTRY
// ════════════════════════════════════

async function registerDevice(session: SessionData): Promise<void> {
  if (!session.device_fingerprint) return;

  const { data: existing } = await supabase
    .from('user_devices')
    .select('id, login_count, ip_addresses, countries')
    .eq('user_id', session.user_id)
    .eq('device_fingerprint', session.device_fingerprint)
    .maybeSingle();

  if (existing) {
    const ips = new Set([...((existing as any).ip_addresses ?? []), session.ip_address].filter(Boolean));
    const countries = new Set([...((existing as any).countries ?? []), session.country].filter(Boolean));
    
    await supabase
      .from('user_devices')
      .update({
        last_seen: new Date().toISOString(),
        login_count: ((existing as any).login_count ?? 0) + 1,
        ip_addresses: [...ips],
        countries: [...countries],
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', (existing as any).id);
  } else {
    await supabase.from('user_devices').insert({
      user_id: session.user_id,
      device_fingerprint: session.device_fingerprint,
      device_name: `${session.browser} on ${session.os}`,
      browser: session.browser,
      browser_version: null,
      os: session.os,
      device_type: session.device_type,
      ip_addresses: session.ip_address ? [session.ip_address] : [],
      countries: session.country ? [session.country] : [],
    } as any);
  }
}

// ════════════════════════════════════
// DEVICE TRUST
// ════════════════════════════════════

export async function markDeviceTrusted(deviceId: string, trustedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_devices')
    .update({
      trusted: true,
      trusted_at: new Date().toISOString(),
      trusted_by: trustedBy,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', deviceId);
  return !error;
}

export async function markDeviceUntrusted(deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_devices')
    .update({
      trusted: false,
      trusted_at: null,
      trusted_by: null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', deviceId);
  return !error;
}
