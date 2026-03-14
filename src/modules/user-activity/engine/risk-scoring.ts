/**
 * Risk Scoring Engine — Calculates risk score for a login session
 * based on device history, geolocation, VPN usage, and travel analysis.
 */

export interface RiskFactor {
  rule: string;
  points: number;
  description: string;
}

export interface RiskResult {
  score: number;
  level: 'normal' | 'attention' | 'high_risk';
  factors: RiskFactor[];
}

interface SessionContext {
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
}

interface HistorySession {
  ip_address: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  device_type: string | null;
  browser: string | null;
  login_at: string;
}

/**
 * Haversine distance in km between two lat/lon pairs.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateRiskScore(
  current: SessionContext,
  history: HistorySession[]
): RiskResult {
  const factors: RiskFactor[] = [];

  // 1. VPN detection → +30
  if (current.is_vpn) {
    factors.push({ rule: 'vpn_detected', points: 30, description: 'Login via VPN detectado' });
  }

  // 2. Proxy detection → +20
  if (current.is_proxy) {
    factors.push({ rule: 'proxy_detected', points: 20, description: 'Login via Proxy detectado' });
  }

  // 3. New IP → +20
  const knownIps = new Set(history.map(h => h.ip_address).filter(Boolean));
  if (current.ip_address && !knownIps.has(current.ip_address)) {
    factors.push({ rule: 'new_ip', points: 20, description: `IP novo: ${current.ip_address}` });
  }

  // 4. New country → +40
  const knownCountries = new Set(history.map(h => h.country).filter(Boolean));
  if (current.country && !knownCountries.has(current.country)) {
    factors.push({ rule: 'new_country', points: 40, description: `País novo: ${current.country}` });
  }

  // 5. New device (browser + device_type combo) → +20
  const knownDevices = new Set(history.map(h => `${h.browser}|${h.device_type}`));
  const currentDevice = `${current.browser}|${current.device_type}`;
  if (!knownDevices.has(currentDevice)) {
    factors.push({ rule: 'new_device', points: 20, description: `Dispositivo novo: ${current.browser} (${current.device_type})` });
  }

  // 6. Impossible travel — distance > 5000km in < 30min
  if (current.latitude != null && current.longitude != null && history.length > 0) {
    const recentWithGeo = history
      .filter(h => h.latitude != null && h.longitude != null)
      .sort((a, b) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime());

    if (recentWithGeo.length > 0) {
      const last = recentWithGeo[0];
      const dist = haversineKm(current.latitude, current.longitude, last.latitude!, last.longitude!);
      const timeDiffMin = (Date.now() - new Date(last.login_at).getTime()) / 60000;

      if (dist > 5000 && timeDiffMin < 30) {
        factors.push({
          rule: 'impossible_travel',
          points: 50,
          description: `Viagem impossível: ${Math.round(dist)}km em ${Math.round(timeDiffMin)}min`,
        });
      } else if (dist > 1000 && timeDiffMin < 60) {
        // Speed > 900km/h
        const speedKmH = dist / (timeDiffMin / 60);
        if (speedKmH > 900) {
          factors.push({
            rule: 'impossible_travel',
            points: 50,
            description: `Velocidade suspeita: ${Math.round(speedKmH)}km/h (${Math.round(dist)}km em ${Math.round(timeDiffMin)}min)`,
          });
        }
      }
    }
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const level: RiskResult['level'] =
    score >= 60 ? 'high_risk' : score >= 30 ? 'attention' : 'normal';

  return { score, level, factors };
}
