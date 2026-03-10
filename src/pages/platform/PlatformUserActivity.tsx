/**
 * PlatformUserActivity — User Activity Intelligence Module
 * 
 * SaaS-level monitoring of user sessions across ALL tenants.
 * Shows online users, geographic map, device/browser stats, suspicious activity.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSessionRealtime, type SessionRealtimeEvent, type ChannelStatus } from '@/domains/session/useSessionRealtime';
import { AlertsPanel } from '@/components/platform/AlertsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  Users, Globe, Monitor, Smartphone, Shield, AlertTriangle,
  MapPin, Clock, Activity, Wifi, WifiOff, Search, Laptop,
  Radio, Zap, LogIn, LogOut, RefreshCw, Trash2, BarChart3
} from 'lucide-react';

// ═══════════════════════════════
// TYPES
// ═══════════════════════════════

interface UserSession {
  id: string;
  tenant_id: string | null;
  user_id: string;
  session_token: string | null;
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
  is_mobile: boolean | null;
  is_vpn: boolean | null;
  is_proxy: boolean | null;
  session_duration: number | null;
  status: string;
}

// ═══════════════════════════════
// HOOKS
// ═══════════════════════════════

function useAllSessions() {
  return useQuery({
    queryKey: ['platform-user-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .order('last_activity', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as UserSession[];
    },
    refetchInterval: 30_000,
  });
}

// ═══════════════════════════════
// SUSPICIOUS BEHAVIOR DETECTION
// ═══════════════════════════════

type SuspiciousType = 'vpn' | 'proxy' | 'multi_country' | 'impossible_travel' | 'new_device' | 'unusual_hours';

interface SuspiciousFlag {
  type: SuspiciousType;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectSuspicious(sessions: UserSession[]): Map<string, SuspiciousFlag[]> {
  const flags = new Map<string, SuspiciousFlag[]>();

  // Group sessions by user
  const byUser = new Map<string, UserSession[]>();
  sessions.forEach(s => {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  });

  // Build known device fingerprints per user (browser + os + device_type)
  const knownDevices = new Map<string, Set<string>>();
  sessions.forEach(s => {
    const fp = `${s.browser ?? ''}|${s.os ?? ''}|${s.device_type ?? ''}`;
    if (!knownDevices.has(s.user_id)) knownDevices.set(s.user_id, new Set());
    knownDevices.get(s.user_id)!.add(fp);
  });

  sessions.forEach(s => {
    const f: SuspiciousFlag[] = [];
    const userSessions = byUser.get(s.user_id) ?? [];

    // ── Rule 1: VPN detected ──
    if (s.is_vpn) {
      f.push({ type: 'vpn', label: 'VPN Detectada', severity: 'medium', details: `IP: ${s.ip_address ?? '?'}` });
    }

    // ── Rule 2: Proxy detected ──
    if (s.is_proxy) {
      f.push({ type: 'proxy', label: 'Proxy Detectado', severity: 'high', details: `IP: ${s.ip_address ?? '?'}` });
    }

    // ── Rule 3: Simultaneous login in different countries ──
    const onlineSessions = userSessions.filter(us => us.status === 'online' && us.id !== s.id);
    const otherCountries = new Set(onlineSessions.map(us => us.country).filter(Boolean));
    if (s.country && otherCountries.size > 0 && !otherCountries.has(s.country)) {
      const countries = [s.country, ...Array.from(otherCountries)].join(', ');
      f.push({
        type: 'multi_country',
        label: 'Login simultâneo multi-país',
        severity: 'critical',
        details: `Países: ${countries}`,
      });
    }

    // ── Rule 4: Impossible travel (>5000km in <30min) ──
    if (s.latitude && s.longitude) {
      const loginTime = new Date(s.login_at).getTime();
      for (const other of userSessions) {
        if (other.id === s.id || !other.latitude || !other.longitude) continue;
        const otherTime = new Date(other.login_at).getTime();
        const diffMin = Math.abs(loginTime - otherTime) / 60000;
        if (diffMin > 0 && diffMin <= 30) {
          const dist = haversineKm(s.latitude, s.longitude, other.latitude, other.longitude);
          if (dist > 5000) {
            f.push({
              type: 'impossible_travel',
              label: 'Viagem impossível',
              severity: 'critical',
              details: `${Math.round(dist)}km em ${Math.round(diffMin)}min`,
            });
            break; // one flag per session is enough
          }
        }
      }
    }

    // ── Rule 5: New/unknown device ──
    const deviceFp = `${s.browser ?? ''}|${s.os ?? ''}|${s.device_type ?? ''}`;
    const userDevices = knownDevices.get(s.user_id);
    // If user has >1 known device and this is the only session with this fingerprint
    if (userDevices && userDevices.size > 1) {
      const sessionsWithThisFp = userSessions.filter(
        us => `${us.browser ?? ''}|${us.os ?? ''}|${us.device_type ?? ''}` === deviceFp
      );
      if (sessionsWithThisFp.length === 1) {
        f.push({
          type: 'new_device',
          label: 'Dispositivo novo',
          severity: 'medium',
          details: `${s.browser ?? '?'} / ${s.os ?? '?'} / ${s.device_type ?? '?'}`,
        });
      }
    }

    // ── Rule 6: Unusual hours (midnight to 5am) ──
    const hour = new Date(s.login_at).getHours();
    if (hour >= 0 && hour < 5) {
      f.push({ type: 'unusual_hours', label: 'Horário incomum', severity: 'low', details: `Login às ${String(hour).padStart(2, '0')}h` });
    }

    if (f.length > 0) flags.set(s.id, f);
  });

  return flags;
}

// ═══════════════════════════════
// RISK SCORE ENGINE
// ═══════════════════════════════

type RiskLevel = 'normal' | 'attention' | 'high';

interface SessionRiskScore {
  score: number;
  level: RiskLevel;
  factors: { label: string; points: number }[];
}

function computeRiskScores(
  sessions: UserSession[],
  flags: Map<string, SuspiciousFlag[]>
): Map<string, SessionRiskScore> {
  const scores = new Map<string, SessionRiskScore>();

  // Known IPs per user (seen more than once)
  const userIps = new Map<string, Map<string, number>>();
  sessions.forEach(s => {
    if (!s.ip_address) return;
    if (!userIps.has(s.user_id)) userIps.set(s.user_id, new Map());
    const ips = userIps.get(s.user_id)!;
    ips.set(s.ip_address, (ips.get(s.ip_address) ?? 0) + 1);
  });

  // Known devices per user
  const userDeviceCounts = new Map<string, Map<string, number>>();
  sessions.forEach(s => {
    const fp = `${s.browser ?? ''}|${s.os ?? ''}|${s.device_type ?? ''}`;
    if (!userDeviceCounts.has(s.user_id)) userDeviceCounts.set(s.user_id, new Map());
    const devs = userDeviceCounts.get(s.user_id)!;
    devs.set(fp, (devs.get(fp) ?? 0) + 1);
  });

  // Most common country per user
  const userCountryCounts = new Map<string, Map<string, number>>();
  sessions.forEach(s => {
    if (!s.country) return;
    if (!userCountryCounts.has(s.user_id)) userCountryCounts.set(s.user_id, new Map());
    const cc = userCountryCounts.get(s.user_id)!;
    cc.set(s.country, (cc.get(s.country) ?? 0) + 1);
  });

  sessions.forEach(s => {
    let score = 0;
    const factors: { label: string; points: number }[] = [];

    // IP novo (+20): IP seen only once for this user
    const ipCount = userIps.get(s.user_id)?.get(s.ip_address ?? '') ?? 0;
    if (s.ip_address && ipCount <= 1) {
      score += 20;
      factors.push({ label: 'IP novo', points: 20 });
    }

    // VPN (+30)
    if (s.is_vpn) {
      score += 30;
      factors.push({ label: 'VPN', points: 30 });
    }

    // País diferente (+40): not the user's most common country
    if (s.country) {
      const cc = userCountryCounts.get(s.user_id);
      if (cc && cc.size > 1) {
        const mainCountry = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (mainCountry && s.country !== mainCountry) {
          score += 40;
          factors.push({ label: 'País diferente', points: 40 });
        }
      }
    }

    // Dispositivo novo (+20): device fingerprint seen only once
    const fp = `${s.browser ?? ''}|${s.os ?? ''}|${s.device_type ?? ''}`;
    const devCount = userDeviceCounts.get(s.user_id)?.get(fp) ?? 0;
    if (devCount <= 1) {
      score += 20;
      factors.push({ label: 'Dispositivo novo', points: 20 });
    }

    // Bonus from suspicious flags
    const sessionFlags = flags.get(s.id);
    if (sessionFlags) {
      if (sessionFlags.some(f => f.type === 'impossible_travel')) {
        score += 30;
        factors.push({ label: 'Viagem impossível', points: 30 });
      }
      if (sessionFlags.some(f => f.type === 'multi_country')) {
        score += 20;
        factors.push({ label: 'Multi-país simultâneo', points: 20 });
      }
      if (sessionFlags.some(f => f.type === 'proxy')) {
        score += 20;
        factors.push({ label: 'Proxy', points: 20 });
      }
    }

    const level: RiskLevel = score >= 60 ? 'high' : score >= 30 ? 'attention' : 'normal';
    scores.set(s.id, { score: Math.min(score, 100), level, factors });
  });

  return scores;
}

// ═══════════════════════════════
// STATS CARDS
// ═══════════════════════════════

function StatsCards({ sessions }: { sessions: UserSession[] }) {
  const online = sessions.filter(s => s.status === 'online').length;
  const activeSessions = sessions.filter(s => s.status === 'online' || s.status === 'idle').length;
  const uniqueTenants = new Set(sessions.filter(s => s.tenant_id).map(s => s.tenant_id)).size;

  // Average session duration (in minutes) for sessions that have duration
  const durationsMin = sessions
    .filter(s => s.session_duration && s.session_duration > 0)
    .map(s => s.session_duration! / 60);
  const avgDuration = durationsMin.length > 0
    ? Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length)
    : 0;

  const cards = [
    { label: 'Usuários Online', value: online, icon: Users, color: 'text-primary' },
    { label: 'Sessões Ativas', value: activeSessions, icon: Activity, color: 'text-primary' },
    { label: 'Tenants Ativos', value: uniqueTenants, icon: Globe, color: 'text-primary' },
    { label: 'Tempo Médio de Sessão', value: `${avgDuration}min`, icon: Clock, color: 'text-primary' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="border-border/50">
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <c.icon className={`h-5 w-5 ${c.color}`} />
            <span className="text-2xl font-bold">{c.value}</span>
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════
// INTERACTIVE LEAFLET MAP
// ═══════════════════════════════

function SessionMap({ sessions, suspiciousIds }: { sessions: UserSession[]; suspiciousIds: Set<string> }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any>(null);

  const geoSessions = useMemo(
    () => sessions.filter(s => s.latitude && s.longitude),
    [sessions]
  );

  useEffect(() => {
    if (!mapRef.current || geoSessions.length === 0) return;

    let L: any;
    let isMounted = true;

    const initMap = async () => {
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      if (!isMounted || !mapRef.current) return;

      // Create map only once
      if (!leafletMap.current) {
        leafletMap.current = L.map(mapRef.current, {
          center: [geoSessions[0].latitude!, geoSessions[0].longitude!],
          zoom: 3,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(leafletMap.current);
      }

      // Clear old markers
      if (markersRef.current) {
        leafletMap.current.removeLayer(markersRef.current);
      }

      const markerGroup = L.layerGroup();

      geoSessions.forEach(s => {
        const isSuspicious = suspiciousIds.has(s.id);
        const color = isSuspicious
          ? '#ef4444' // red — suspicious
          : s.status === 'online'
            ? '#22c55e' // green — online
            : s.status === 'idle'
              ? '#eab308' // yellow — idle
              : '#6b7280'; // gray — offline

        const circle = L.circleMarker([s.latitude!, s.longitude!], {
          radius: 7,
          fillColor: color,
          color: color,
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.7,
        });

        const timestamp = new Date(s.login_at).toLocaleString('pt-BR');
        circle.bindPopup(`
          <div style="font-size:12px;line-height:1.6">
            <strong>Usuário:</strong> ${s.user_id.slice(0, 8)}…<br/>
            <strong>Tenant:</strong> ${s.tenant_id?.slice(0, 8) ?? '—'}…<br/>
            <strong>Local:</strong> ${s.city ?? '—'}, ${s.country ?? '—'}<br/>
            <strong>IP:</strong> ${s.ip_address ?? '—'}<br/>
            <strong>Navegador:</strong> ${s.browser ?? '—'}<br/>
            <strong>Status:</strong> ${s.status}${isSuspicious ? ' ⚠️ Suspeito' : ''}<br/>
            <strong>Login:</strong> ${timestamp}
          </div>
        `);

        markerGroup.addLayer(circle);
      });

      markerGroup.addTo(leafletMap.current);
      markersRef.current = markerGroup;

      // Fit bounds
      if (geoSessions.length > 1) {
        const bounds = L.latLngBounds(geoSessions.map(s => [s.latitude!, s.longitude!]));
        leafletMap.current.fitBounds(bounds, { padding: [30, 30] });
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [geoSessions, suspiciousIds]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  if (geoSessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Sem dados de geolocalização disponíveis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" /> Mapa Global de Logins
          </CardTitle>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Online</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Idle</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Suspeito</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={mapRef} className="w-full h-[500px] rounded-lg overflow-hidden border border-border" />
        <p className="text-[10px] text-muted-foreground mt-2 text-right">
          {geoSessions.length} sessões com geolocalização
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════
// BROWSER / DEVICE DISTRIBUTION
// ═══════════════════════════════

function DeviceDistribution({ sessions }: { sessions: UserSession[] }) {
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();

  sessions.forEach(s => {
    browserCounts.set(s.browser ?? 'Unknown', (browserCounts.get(s.browser ?? 'Unknown') ?? 0) + 1);
    osCounts.set(s.os ?? 'Unknown', (osCounts.get(s.os ?? 'Unknown') ?? 0) + 1);
    deviceCounts.set(s.device_type ?? 'Unknown', (deviceCounts.get(s.device_type ?? 'Unknown') ?? 0) + 1);
  });

  const sortedEntries = (map: Map<string, number>) =>
    Array.from(map.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" /> Navegadores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedEntries(browserCounts).map(([name, count]) => (
            <div key={name} className="flex justify-between text-sm">
              <span>{name}</span>
              <Badge variant="outline" className="text-xs">{count}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Sistemas Operacionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedEntries(osCounts).map(([name, count]) => (
            <div key={name} className="flex justify-between text-sm">
              <span>{name}</span>
              <Badge variant="outline" className="text-xs">{count}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Laptop className="h-4 w-4" /> Dispositivos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedEntries(deviceCounts).map(([name, count]) => (
            <div key={name} className="flex justify-between text-sm">
              <span className="capitalize">{name}</span>
              <Badge variant="outline" className="text-xs">{count}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════
// SUSPICIOUS ACTIVITY PANEL
// ═══════════════════════════════

function SuspiciousPanel({ sessions, flags }: { sessions: UserSession[]; flags: Map<string, SuspiciousFlag[]> }) {
  const flagged = useMemo(() => {
    const list = sessions.filter(s => flags.has(s.id));
    // Sort by highest severity first
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return list.sort((a, b) => {
      const aMax = Math.min(...(flags.get(a.id)?.map(f => sevOrder[f.severity] ?? 9) ?? [9]));
      const bMax = Math.min(...(flags.get(b.id)?.map(f => sevOrder[f.severity] ?? 9) ?? [9]));
      return aMax - bMax;
    });
  }, [sessions, flags]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    flags.forEach(ff => ff.forEach(f => { counts[f.severity]++; }));
    return counts;
  }, [flags]);

  const severityVariant = (sev: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (sev === 'critical') return 'destructive';
    if (sev === 'high') return 'destructive';
    if (sev === 'medium') return 'secondary';
    return 'outline';
  };

  if (flagged.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma atividade suspeita detectada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        {severityCounts.critical > 0 && (
          <Badge variant="destructive" className="text-xs">🔴 Crítico: {severityCounts.critical}</Badge>
        )}
        {severityCounts.high > 0 && (
          <Badge variant="destructive" className="text-xs opacity-80">🟠 Alto: {severityCounts.high}</Badge>
        )}
        {severityCounts.medium > 0 && (
          <Badge variant="secondary" className="text-xs">🟡 Médio: {severityCounts.medium}</Badge>
        )}
        {severityCounts.low > 0 && (
          <Badge variant="outline" className="text-xs">🟢 Baixo: {severityCounts.low}</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Atividades Suspeitas ({flagged.length} sessões)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severidade</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Alertas</TableHead>
                <TableHead>Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagged.slice(0, 50).map(s => {
                const sessionFlags = flags.get(s.id) ?? [];
                const maxSev = sessionFlags.reduce((max, f) => {
                  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[f.severity] ?? 9) < (order[max] ?? 9) ? f.severity : max;
                }, 'low' as string);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant={severityVariant(maxSev)} className="text-[10px] uppercase">
                        {maxSev === 'critical' ? '🔴' : maxSev === 'high' ? '🟠' : maxSev === 'medium' ? '🟡' : '🟢'} {maxSev}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-mono text-xs">{s.tenant_id?.slice(0, 8) ?? '—'}…</TableCell>
                    <TableCell className="text-xs">{s.ip_address ?? '—'}</TableCell>
                    <TableCell className="text-xs">{[s.city, s.country].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {sessionFlags.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Badge variant={severityVariant(f.severity)} className="text-[10px] shrink-0">
                              {f.label}
                            </Badge>
                            {f.details && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{f.details}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(s.login_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════
// IP ASN/ISP LOOKUP HOOK
// ═══════════════════════════════

interface IpInfo {
  isp: string;
  org: string;
  as: string; // e.g. "AS12345 Company Name"
}

const ipCache = new Map<string, IpInfo | 'loading' | 'error'>();

function useIpLookup(ips: string[]) {
  const [results, setResults] = useState<Map<string, IpInfo | 'loading' | 'error'>>(new Map());

  useEffect(() => {
    const uniqueIps = [...new Set(ips.filter(ip => ip && ip !== '—'))];
    const toFetch = uniqueIps.filter(ip => !ipCache.has(ip));

    if (toFetch.length === 0) {
      // All cached
      const map = new Map<string, IpInfo | 'loading' | 'error'>();
      uniqueIps.forEach(ip => { if (ipCache.has(ip)) map.set(ip, ipCache.get(ip)!); });
      setResults(map);
      return;
    }

    // Mark as loading
    toFetch.forEach(ip => ipCache.set(ip, 'loading'));
    setResults(new Map(ipCache));

    // Batch fetch (ip-api supports batch up to 100)
    const batches: string[][] = [];
    for (let i = 0; i < toFetch.length; i += 100) {
      batches.push(toFetch.slice(i, i + 100));
    }

    batches.forEach(async (batch) => {
      try {
        const resp = await fetch('http://ip-api.com/batch?fields=query,isp,org,as', {
          method: 'POST',
          body: JSON.stringify(batch.map(ip => ({ query: ip }))),
        });
        if (!resp.ok) throw new Error('batch failed');
        const data: Array<{ query: string; isp?: string; org?: string; as?: string }> = await resp.json();
        data.forEach(d => {
          ipCache.set(d.query, { isp: d.isp ?? '', org: d.org ?? '', as: d.as ?? '' });
        });
      } catch {
        batch.forEach(ip => ipCache.set(ip, 'error'));
      }
      setResults(new Map(ipCache));
    });
  }, [ips.join(',')]);

  return results;
}

/** Render IP cell with ASN/ISP info below */
function IpCell({ ip, info }: { ip: string; info?: IpInfo | 'loading' | 'error' }) {
  return (
    <div>
      <span className="font-mono">{ip}</span>
      {info === 'loading' && (
        <p className="text-[10px] text-muted-foreground animate-pulse">carregando…</p>
      )}
      {info === 'error' && (
        <p className="text-[10px] text-muted-foreground">—</p>
      )}
      {info && typeof info === 'object' && (
        <p className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={`${info.as} · ${info.isp}`}>
          {info.as?.split(' ').slice(0, 1).join('')} · {info.isp || info.org || '—'}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════
// SESSIONS TABLE
// ═══════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  online: { label: 'Online', variant: 'default', icon: <Wifi className="h-3 w-3" /> },
  idle: { label: 'Idle', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  offline: { label: 'Offline', variant: 'outline', icon: <WifiOff className="h-3 w-3" /> },
  expired: { label: 'Expirada', variant: 'destructive', icon: <WifiOff className="h-3 w-3" /> },
};

function SessionsTable({ sessions, search, statusFilter, tenantFilter, countryFilter, cityFilter, browserFilter, riskScores }: {
  sessions: UserSession[];
  search: string;
  statusFilter: string;
  tenantFilter: string;
  countryFilter: string;
  cityFilter: string;
  browserFilter: string;
  riskScores: Map<string, SessionRiskScore>;
}) {
  const filtered = useMemo(() => {
    let result = sessions;
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    if (tenantFilter && tenantFilter !== 'all') {
      result = result.filter(s => s.tenant_id === tenantFilter);
    }
    if (countryFilter && countryFilter !== 'all') {
      result = result.filter(s => s.country === countryFilter);
    }
    if (cityFilter && cityFilter !== 'all') {
      result = result.filter(s => s.city === cityFilter);
    }
    if (browserFilter && browserFilter !== 'all') {
      result = result.filter(s => s.browser === browserFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.user_id.toLowerCase().includes(q) ||
        s.ip_address?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.browser?.toLowerCase().includes(q) ||
        s.tenant_id?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sessions, search, statusFilter, tenantFilter, countryFilter, cityFilter, browserFilter]);

  const riskBadge = (risk: SessionRiskScore) => {
    const variant: 'default' | 'secondary' | 'outline' | 'destructive' =
      risk.level === 'high' ? 'destructive' : risk.level === 'attention' ? 'secondary' : 'outline';
    const label = risk.level === 'high' ? 'Alto' : risk.level === 'attention' ? 'Atenção' : 'Normal';
    return (
      <Badge variant={variant} className="text-[10px] gap-1 cursor-help" title={risk.factors.map(f => `${f.label}: +${f.points}`).join('\n')}>
        {risk.score} · {label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risco</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>País</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Navegador</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead>Tempo Online</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Nenhuma sessão encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 100).map(s => {
                const st = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.offline;
                const duration = s.session_duration
                  ? `${Math.floor(s.session_duration / 60)}min`
                  : s.status === 'online'
                    ? formatDistanceToNow(new Date(s.login_at), { locale: ptBR, addSuffix: false })
                    : '—';
                const risk = riskScores.get(s.id) ?? { score: 0, level: 'normal' as RiskLevel, factors: [] };

                return (
                  <TableRow key={s.id}>
                    <TableCell>{riskBadge(risk)}</TableCell>
                    <TableCell className="font-mono text-xs">{s.tenant_id?.slice(0, 8) ?? '—'}…</TableCell>
                    <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs">{s.city ?? '—'}</TableCell>
                    <TableCell className="text-xs">{s.country ?? '—'}</TableCell>
                    <TableCell className="text-xs">{s.ip_address ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {s.browser ?? '?'} {s.browser_version?.split('.')[0] ?? ''}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{s.device_type ?? '—'}</TableCell>
                    <TableCell className="text-xs">{duration}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant} className="gap-1 text-[10px]">
                        {st.icon} {st.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════
// LIVE EVENT FEED
// ═══════════════════════════════

const EVENT_ICONS: Record<string, React.ReactNode> = {
  SESSION_STARTED: <LogIn className="h-3.5 w-3.5 text-green-500" />,
  SESSION_UPDATED: <RefreshCw className="h-3.5 w-3.5 text-blue-500" />,
  SESSION_ENDED: <LogOut className="h-3.5 w-3.5 text-muted-foreground" />,
};

const EVENT_LABELS: Record<string, string> = {
  SESSION_STARTED: 'Sessão Iniciada',
  SESSION_UPDATED: 'Sessão Atualizada',
  SESSION_ENDED: 'Sessão Encerrada',
};

function LiveEventFeed({ events, channelStatus, counters, onClear }: {
  events: SessionRealtimeEvent[];
  channelStatus: ChannelStatus;
  counters: { started: number; updated: number; ended: number };
  onClear: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Radio className={`h-4 w-4 ${channelStatus === 'connected' ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
            Eventos em Tempo Real
            <Badge variant={channelStatus === 'connected' ? 'default' : 'destructive'} className="text-[10px] ml-1">
              {channelStatus === 'connected' ? 'Conectado' : channelStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><Zap className="h-3 w-3 text-green-500" />{counters.started}</span>
              <span className="flex items-center gap-0.5"><RefreshCw className="h-3 w-3 text-blue-500" />{counters.updated}</span>
              <span className="flex items-center gap-0.5"><LogOut className="h-3 w-3" />{counters.ended}</span>
            </div>
            {events.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onClear}>
                <Trash2 className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            Aguardando eventos de sessão...
          </p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1.5">
              {events.map(evt => (
                <div key={evt.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/20 text-xs">
                  {EVENT_ICONS[evt.type]}
                  <span className="font-medium">{EVENT_LABELS[evt.type]}</span>
                  <span className="text-muted-foreground font-mono">{evt.userId.slice(0, 8)}…</span>
                  {evt.city && <span className="text-muted-foreground">· {evt.city}</span>}
                  {evt.browser && <span className="text-muted-foreground">· {evt.browser}</span>}
                  <span className="ml-auto text-muted-foreground/70">
                    {format(evt.timestamp, 'HH:mm:ss', { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════
// LOGIN HEATMAPS
// ═══════════════════════════════

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent-foreground))',
  'hsl(var(--muted-foreground))',
];

function countBy(sessions: UserSession[], keyFn: (s: UserSession) => string | null): { name: string; count: number }[] {
  const map = new Map<string, number>();
  sessions.forEach(s => {
    const key = keyFn(s) ?? 'Desconhecido';
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function HeatmapChart({ title, icon: Icon, data, maxBars = 15 }: {
  title: string;
  icon: React.ElementType;
  data: { name: string; count: number }[];
  maxBars?: number;
}) {
  const sliced = data.slice(0, maxBars);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sliced.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados disponíveis.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, sliced.length * 32)}>
            <BarChart data={sliced} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: 12,
                  color: 'hsl(var(--card-foreground))',
                }}
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                formatter={(value: number) => [`${value} logins`, 'Total']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {sliced.map((_, i) => (
                  <Cell key={i} fill={`hsl(var(--primary) / ${1 - i * 0.04})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function LoginHeatmaps({ sessions }: { sessions: UserSession[] }) {
  const byCountry = useMemo(() => countBy(sessions, s => s.country), [sessions]);
  const byCity = useMemo(() => countBy(sessions, s => s.city), [sessions]);
  const byTenant = useMemo(() => countBy(sessions, s => s.tenant_id ? s.tenant_id.slice(0, 8) + '…' : null), [sessions]);
  const byHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ name: `${String(i).padStart(2, '0')}h`, count: 0 }));
    sessions.forEach(s => {
      const h = new Date(s.login_at).getHours();
      hours[h].count++;
    });
    return hours;
  }, [sessions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <HeatmapChart title="Logins por País" icon={Globe} data={byCountry} />
      <HeatmapChart title="Logins por Cidade" icon={MapPin} data={byCity} />
      <HeatmapChart title="Logins por Tenant" icon={Users} data={byTenant} />
      <HeatmapChart title="Logins por Hora" icon={Clock} data={byHour} maxBars={24} />
    </div>
  );
}

// ═══════════════════════════════
// MAIN PAGE
// ═══════════════════════════════

export default function PlatformUserActivity() {
  const { data: sessions = [], isLoading } = useAllSessions();
  const { events, channelStatus, counters, clearEvents } = useSessionRealtime();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [browserFilter, setBrowserFilter] = useState('all');

  const suspiciousFlags = useMemo(() => detectSuspicious(sessions), [sessions]);
  const riskScores = useMemo(() => computeRiskScores(sessions, suspiciousFlags), [sessions, suspiciousFlags]);

  // Derive unique filter options from sessions
  const tenantOptions = useMemo(() => [...new Set(sessions.map(s => s.tenant_id).filter(Boolean) as string[])].sort(), [sessions]);
  const countryOptions = useMemo(() => [...new Set(sessions.map(s => s.country).filter(Boolean) as string[])].sort(), [sessions]);
  const cityOptions = useMemo(() => [...new Set(sessions.map(s => s.city).filter(Boolean) as string[])].sort(), [sessions]);
  const browserOptions = useMemo(() => [...new Set(sessions.map(s => s.browser).filter(Boolean) as string[])].sort(), [sessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando sessões...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Monitor</h1>
          <p className="text-muted-foreground text-sm">
            Monitoramento em tempo real de sessões de usuários em todos os tenants.
          </p>
        </div>
        <Badge variant={channelStatus === 'connected' ? 'default' : 'outline'} className="gap-1.5">
          <Radio className={`h-3 w-3 ${channelStatus === 'connected' ? 'animate-pulse' : ''}`} />
          {channelStatus === 'connected' ? 'Realtime Ativo' : 'Reconectando...'}
        </Badge>
      </div>

      {/* Stats */}
      <StatsCards sessions={sessions} />

      {/* Live Feed + Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Event Feed */}
        <div className="lg:col-span-1 lg:order-2">
          <LiveEventFeed events={events} channelStatus={channelStatus} counters={counters} onClear={clearEvents} />
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 lg:order-1">
          <Tabs defaultValue="sessions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sessions">Sessões Ativas</TabsTrigger>
              <TabsTrigger value="alerts">
                Alertas
                {(() => {
                  const openAlerts = Array.from(suspiciousFlags.values()).flat().length;
                  return openAlerts > 0 ? (
                    <Badge variant="destructive" className="ml-2 text-[10px] px-1.5">{openAlerts}</Badge>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
              <TabsTrigger value="map">Mapa</TabsTrigger>
              <TabsTrigger value="devices">Dispositivos</TabsTrigger>
              <TabsTrigger value="suspicious">
                Suspeitas
                {suspiciousFlags.size > 0 && (
                  <Badge variant="destructive" className="ml-2 text-[10px] px-1.5">
                    {suspiciousFlags.size}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-4">
              {/* Filters row */}
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ID, IP, cidade, navegador..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={tenantFilter} onValueChange={setTenantFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Tenants</SelectItem>
                    {tenantOptions.map(t => (
                      <SelectItem key={t} value={t}>{t.slice(0, 8)}…</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="País" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Países</SelectItem>
                    {countryOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Cidades</SelectItem>
                    {cityOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="expired">Expirada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={browserFilter} onValueChange={setBrowserFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Navegador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {browserOptions.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SessionsTable
                sessions={sessions}
                search={search}
                statusFilter={statusFilter}
                tenantFilter={tenantFilter}
                countryFilter={countryFilter}
                cityFilter={cityFilter}
                browserFilter={browserFilter}
                riskScores={riskScores}
              />
            </TabsContent>

            <TabsContent value="alerts">
              <AlertsPanel sessions={sessions} flags={suspiciousFlags} riskScores={riskScores} />
            </TabsContent>

            <TabsContent value="heatmap">
              <LoginHeatmaps sessions={sessions} />
            </TabsContent>

            <TabsContent value="map">
              <SessionMap sessions={sessions} suspiciousIds={new Set(suspiciousFlags.keys())} />
            </TabsContent>

            <TabsContent value="devices">
              <DeviceDistribution sessions={sessions} />
            </TabsContent>

            <TabsContent value="suspicious">
              <SuspiciousPanel sessions={sessions} flags={suspiciousFlags} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
