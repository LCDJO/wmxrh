/**
 * PlatformUserActivity — User Activity Intelligence Module
 * 
 * SaaS-level monitoring of user sessions across ALL tenants.
 * Shows online users, geographic map, device/browser stats, suspicious activity.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, Globe, Monitor, Smartphone, Shield, AlertTriangle,
  MapPin, Clock, Activity, Wifi, WifiOff, Search, Laptop
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
    refetchInterval: 30_000, // refresh every 30s
  });
}

// ═══════════════════════════════
// SUSPICIOUS BEHAVIOR DETECTION
// ═══════════════════════════════

interface SuspiciousFlag {
  type: 'vpn' | 'proxy' | 'multi_location' | 'rapid_switch' | 'unusual_hours';
  label: string;
  severity: 'low' | 'medium' | 'high';
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

  sessions.forEach(s => {
    const f: SuspiciousFlag[] = [];

    if (s.is_vpn) f.push({ type: 'vpn', label: 'VPN Detectada', severity: 'medium' });
    if (s.is_proxy) f.push({ type: 'proxy', label: 'Proxy Detectado', severity: 'high' });

    // Multiple locations for same user in last 24h
    const userSessions = byUser.get(s.user_id) ?? [];
    const recentLocations = new Set(
      userSessions
        .filter(us => us.city && new Date(us.login_at).getTime() > Date.now() - 86400000)
        .map(us => us.city)
    );
    if (recentLocations.size > 2) {
      f.push({ type: 'multi_location', label: `${recentLocations.size} cidades em 24h`, severity: 'high' });
    }

    // Login at unusual hours (midnight to 5am)
    const hour = new Date(s.login_at).getHours();
    if (hour >= 0 && hour < 5) {
      f.push({ type: 'unusual_hours', label: 'Horário incomum', severity: 'low' });
    }

    if (f.length > 0) flags.set(s.id, f);
  });

  return flags;
}

// ═══════════════════════════════
// STATS CARDS
// ═══════════════════════════════

function StatsCards({ sessions }: { sessions: UserSession[] }) {
  const online = sessions.filter(s => s.status === 'online').length;
  const idle = sessions.filter(s => s.status === 'idle').length;
  const uniqueTenants = new Set(sessions.filter(s => s.tenant_id).map(s => s.tenant_id)).size;
  const vpnCount = sessions.filter(s => s.is_vpn).length;
  const mobileCount = sessions.filter(s => s.is_mobile).length;

  const cards = [
    { label: 'Online Agora', value: online, icon: Wifi, color: 'text-green-500' },
    { label: 'Idle', value: idle, icon: Clock, color: 'text-yellow-500' },
    { label: 'Tenants Ativos', value: uniqueTenants, icon: Globe, color: 'text-primary' },
    { label: 'Sessões Mobile', value: mobileCount, icon: Smartphone, color: 'text-blue-500' },
    { label: 'VPN/Proxy', value: vpnCount, icon: Shield, color: 'text-destructive' },
    { label: 'Total Sessões (24h)', value: sessions.length, icon: Activity, color: 'text-muted-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
// GEOGRAPHIC MAP (Leaflet)
// ═══════════════════════════════

function SessionMap({ sessions }: { sessions: UserSession[] }) {
  const geoSessions = sessions.filter(s => s.latitude && s.longitude);

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

  // Group by city for summary
  const byCity = new Map<string, { count: number; lat: number; lng: number; online: number }>();
  geoSessions.forEach(s => {
    const key = s.city ?? `${s.latitude?.toFixed(1)},${s.longitude?.toFixed(1)}`;
    const existing = byCity.get(key);
    if (existing) {
      existing.count++;
      if (s.status === 'online') existing.online++;
    } else {
      byCity.set(key, {
        count: 1,
        lat: s.latitude!,
        lng: s.longitude!,
        online: s.status === 'online' ? 1 : 0,
      });
    }
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Mapa de Acessos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-auto">
          {Array.from(byCity.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .map(([city, data]) => (
              <div key={city} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${data.online > 0 ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{city}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.count} sessão(ões) · {data.online} online
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.lat.toFixed(2)}, {data.lng.toFixed(2)}
                </div>
              </div>
            ))}
        </div>
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
  const flagged = sessions.filter(s => flags.has(s.id));

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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Atividades Suspeitas ({flagged.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flagged.slice(0, 50).map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}...</TableCell>
                <TableCell className="text-xs">{s.ip_address ?? '—'}</TableCell>
                <TableCell className="text-xs">{[s.city, s.state, s.country].filter(Boolean).join(', ') || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {flags.get(s.id)?.map((f, i) => (
                      <Badge
                        key={i}
                        variant={f.severity === 'high' ? 'destructive' : f.severity === 'medium' ? 'secondary' : 'outline'}
                        className="text-[10px]"
                      >
                        {f.label}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(s.login_at), 'dd/MM HH:mm', { locale: ptBR })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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

function SessionsTable({ sessions, search, statusFilter }: { sessions: UserSession[]; search: string; statusFilter: string }) {
  const filtered = useMemo(() => {
    let result = sessions;
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.user_id.toLowerCase().includes(q) ||
        s.ip_address?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.browser?.toLowerCase().includes(q) ||
        s.os?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sessions, search, statusFilter]);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Navegador / OS</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Última Atividade</TableHead>
              <TableHead>Duração</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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

                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant={st.variant} className="gap-1 text-[10px]">
                        {st.icon} {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-mono text-xs">{s.tenant_id?.slice(0, 8) ?? '—'}...</TableCell>
                    <TableCell className="text-xs">{s.ip_address ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                      {s.country && <span className="text-muted-foreground"> ({s.country})</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.browser ?? '?'} {s.browser_version?.split('.')[0] ?? ''} / {s.os ?? '?'}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{s.device_type ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {s.login_method ?? 'password'}
                        {s.sso_provider && ` (${s.sso_provider})`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(s.login_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.last_activity), { locale: ptBR, addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-xs">{duration}</TableCell>
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
// MAIN PAGE
// ═══════════════════════════════

export default function PlatformUserActivity() {
  const { data: sessions = [], isLoading } = useAllSessions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const suspiciousFlags = useMemo(() => detectSuspicious(sessions), [sessions]);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Activity Intelligence</h1>
        <p className="text-muted-foreground text-sm">
          Monitoramento em tempo real de acessos de usuários em todos os tenants.
        </p>
      </div>

      {/* Stats */}
      <StatsCards sessions={sessions} />

      {/* Tabs */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessões</TabsTrigger>
          <TabsTrigger value="map">Mapa de Acessos</TabsTrigger>
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
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, IP, cidade, navegador..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
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
          </div>
          <SessionsTable sessions={sessions} search={search} statusFilter={statusFilter} />
        </TabsContent>

        <TabsContent value="map">
          <SessionMap sessions={sessions} />
        </TabsContent>

        <TabsContent value="devices">
          <DeviceDistribution sessions={sessions} />
        </TabsContent>

        <TabsContent value="suspicious">
          <SuspiciousPanel sessions={sessions} flags={suspiciousFlags} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
