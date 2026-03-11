/**
 * LoginSecurityAnalyzer — Detects suspicious login patterns:
 *  1. Multiple simultaneous sessions per user
 *  2. Login from unusual country
 *  3. Rapid location change (impossible travel)
 *
 * Generates SecurityAlert[] for display and integration with
 * Security Kernel, Incident Engine, and Observability.
 */

import type { ActiveSession } from './types';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'simultaneous_sessions' | 'unusual_country' | 'impossible_travel';

export interface SecurityAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  user_id: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

// ════════════════════════════════════════════════
// DETECTION ENGINE
// ════════════════════════════════════════════════

/**
 * Run all security checks against a set of active + recent sessions.
 */
export function analyzeLoginSecurity(
  activeSessions: ActiveSession[],
  recentSessions: ActiveSession[]
): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];

  alerts.push(...detectSimultaneousSessions(activeSessions));
  alerts.push(...detectUnusualCountry(recentSessions));
  alerts.push(...detectImpossibleTravel(recentSessions));

  return alerts.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
}

// ── 1. Multiple simultaneous sessions ──────────────────

function detectSimultaneousSessions(active: ActiveSession[]): SecurityAlert[] {
  const byUser = new Map<string, ActiveSession[]>();
  for (const s of active) {
    if (s.status !== 'online') continue;
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  const alerts: SecurityAlert[] = [];
  for (const [userId, sessions] of byUser) {
    if (sessions.length < 2) continue;

    const uniqueIps = new Set(sessions.map(s => s.ip_address).filter(Boolean));
    const severity: AlertSeverity = uniqueIps.size >= 3 ? 'high' : uniqueIps.size >= 2 ? 'medium' : 'low';

    alerts.push({
      id: `sim_${userId}_${Date.now()}`,
      type: 'simultaneous_sessions',
      severity,
      user_id: userId,
      title: `${sessions.length} sessões simultâneas`,
      description: `Usuário ${userId.slice(0, 8)}… tem ${sessions.length} sessões ativas de ${uniqueIps.size} IP(s) diferentes`,
      metadata: {
        session_count: sessions.length,
        unique_ips: Array.from(uniqueIps),
        locations: sessions.map(s => `${s.city ?? '?'}, ${s.country ?? '?'}`),
      },
      timestamp: Date.now(),
    });
  }
  return alerts;
}

// ── 2. Login from unusual country ──────────────────────

function detectUnusualCountry(sessions: ActiveSession[]): SecurityAlert[] {
  // Build per-user country history
  const userCountries = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    if (!s.country) continue;
    const countries = userCountries.get(s.user_id) ?? new Map<string, number>();
    countries.set(s.country, (countries.get(s.country) ?? 0) + 1);
    userCountries.set(s.user_id, countries);
  }

  const alerts: SecurityAlert[] = [];
  for (const [userId, countries] of userCountries) {
    if (countries.size < 2) continue;

    const total = Array.from(countries.values()).reduce((a, b) => a + b, 0);
    for (const [country, count] of countries) {
      const pct = count / total;
      // If this country represents less than 10% of logins → unusual
      if (pct < 0.1 && count <= 2) {
        alerts.push({
          id: `unusual_${userId}_${country}_${Date.now()}`,
          type: 'unusual_country',
          severity: 'medium',
          user_id: userId,
          title: `Login de país incomum: ${country}`,
          description: `Usuário ${userId.slice(0, 8)}… fez login de ${country} (${count}/${total} sessões — ${Math.round(pct * 100)}%)`,
          metadata: { country, count, total, all_countries: Object.fromEntries(countries) },
          timestamp: Date.now(),
        });
      }
    }
  }
  return alerts;
}

// ── 3. Impossible travel / rapid location change ───────

function detectImpossibleTravel(sessions: ActiveSession[]): SecurityAlert[] {
  // Group by user, sort by login time
  const byUser = new Map<string, ActiveSession[]>();
  for (const s of sessions) {
    if (s.latitude == null || s.longitude == null) continue;
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  const alerts: SecurityAlert[] = [];
  for (const [userId, userSessions] of byUser) {
    const sorted = userSessions.sort((a, b) =>
      new Date(a.login_at).getTime() - new Date(b.login_at).getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const timeDiffMs = new Date(curr.login_at).getTime() - new Date(prev.login_at).getTime();
      const timeDiffHours = timeDiffMs / 3600_000;

      if (timeDiffHours <= 0 || timeDiffHours > 12) continue; // Only check within 12h window

      const distKm = haversineKm(
        prev.latitude!, prev.longitude!,
        curr.latitude!, curr.longitude!
      );

      // Max plausible speed: 900 km/h (fast commercial flight)
      const maxPlausibleKm = timeDiffHours * 900;

      if (distKm > maxPlausibleKm && distKm > 500) {
        const severity: AlertSeverity = distKm > 5000 ? 'critical' : distKm > 2000 ? 'high' : 'medium';

        alerts.push({
          id: `travel_${userId}_${i}_${Date.now()}`,
          type: 'impossible_travel',
          severity,
          user_id: userId,
          title: `Viagem impossível detectada`,
          description: `${prev.city ?? '?'} → ${curr.city ?? '?'} (${Math.round(distKm)} km em ${timeDiffHours.toFixed(1)}h)`,
          metadata: {
            from: { city: prev.city, country: prev.country, lat: prev.latitude, lng: prev.longitude },
            to: { city: curr.city, country: curr.country, lat: curr.latitude, lng: curr.longitude },
            distance_km: Math.round(distKm),
            time_hours: +timeDiffHours.toFixed(2),
            speed_kmh: Math.round(distKm / timeDiffHours),
          },
          timestamp: Date.now(),
        });
      }
    }
  }
  return alerts;
}

// ════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function severityWeight(s: AlertSeverity): number {
  return s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}
