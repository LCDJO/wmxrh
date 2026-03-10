/**
 * TenantSessionDashboard — Reduced session dashboard for tenant workspace.
 * Shows: online users, login map, active sessions, avg usage time.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, Clock, Activity, MapPin, Globe, Monitor, Smartphone, Laptop } from 'lucide-react';

// ═══════════════════════════════
// TYPES
// ═══════════════════════════════

interface UserSession {
  id: string;
  tenant_id: string | null;
  user_id: string;
  login_at: string;
  last_activity: string;
  logout_at: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  is_mobile: boolean | null;
  session_duration: number | null;
  status: string;
}

// ═══════════════════════════════
// HOOK
// ═══════════════════════════════

function useTenantSessions(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-sessions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_activity', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as UserSession[];
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });
}

// ═══════════════════════════════
// METRIC CARDS
// ═══════════════════════════════

function MetricCard({ title, value, subtitle, icon: Icon }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════
// LOGIN MAP (simple)
// ═══════════════════════════════

function LoginMap({ sessions }: { sessions: UserSession[] }) {
  const locations = useMemo(() => {
    const map = new Map<string, { city: string; country: string; count: number; lat: number; lng: number }>();
    sessions.forEach(s => {
      if (!s.city) return;
      const key = `${s.city}-${s.country}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          city: s.city,
          country: s.country ?? '',
          count: 1,
          lat: s.latitude ?? 0,
          lng: s.longitude ?? 0,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [sessions]);

  if (locations.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Sem dados de localização.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {locations.slice(0, 12).map(loc => (
        <div key={`${loc.city}-${loc.country}`} className="flex items-center gap-2 p-2 rounded-md border bg-card">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{loc.city}</p>
            <p className="text-[10px] text-muted-foreground">{loc.country}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">{loc.count}</Badge>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════
// SESSIONS TABLE
// ═══════════════════════════════

function SessionsTable({ sessions }: { sessions: UserSession[] }) {
  const active = sessions.filter(s => s.status === 'online' || s.status === 'idle');
  const displayed = active.length > 0 ? active : sessions.slice(0, 20);

  const deviceIcon = (type: string | null) => {
    if (type === 'mobile') return <Smartphone className="h-3.5 w-3.5" />;
    if (type === 'tablet') return <Laptop className="h-3.5 w-3.5" />;
    return <Monitor className="h-3.5 w-3.5" />;
  };

  const statusBadge = (status: string) => {
    const variant: 'default' | 'secondary' | 'outline' | 'destructive' =
      status === 'online' ? 'default' : status === 'idle' ? 'secondary' : 'outline';
    return <Badge variant={variant} className="text-[10px]">{status}</Badge>;
  };

  return (
    <ScrollArea className="max-h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dispositivo</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Última Atividade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.slice(0, 50).map(s => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}…</TableCell>
              <TableCell>{statusBadge(s.status)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-xs">
                  {deviceIcon(s.device_type)}
                  <span>{s.browser ?? '—'}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs">{[s.city, s.country].filter(Boolean).join(', ') || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{s.ip_address ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(s.last_activity), { addSuffix: true, locale: ptBR })}
              </TableCell>
            </TableRow>
          ))}
          {displayed.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhuma sessão encontrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ═══════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════

interface TenantSessionDashboardProps {
  tenantId: string;
}

export function TenantSessionDashboard({ tenantId }: TenantSessionDashboardProps) {
  const { data: sessions = [], isLoading } = useTenantSessions(tenantId);

  const stats = useMemo(() => {
    const online = sessions.filter(s => s.status === 'online').length;
    const active = sessions.filter(s => s.status === 'online' || s.status === 'idle').length;
    const total = sessions.length;

    // Average session duration (in minutes)
    const durationsMin = sessions
      .filter(s => s.session_duration != null && s.session_duration > 0)
      .map(s => s.session_duration! / 60);
    const avgDuration = durationsMin.length > 0
      ? Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length)
      : 0;

    // Unique countries
    const countries = new Set(sessions.map(s => s.country).filter(Boolean));

    return { online, active, total, avgDuration, countries: countries.size };
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Usuários Online"
          value={stats.online}
          subtitle={`${stats.active} ativos total`}
          icon={Users}
        />
        <MetricCard
          title="Sessões Ativas"
          value={stats.active}
          subtitle={`de ${stats.total} sessões`}
          icon={Activity}
        />
        <MetricCard
          title="Tempo Médio de Uso"
          value={`${stats.avgDuration}min`}
          subtitle="duração média por sessão"
          icon={Clock}
        />
        <MetricCard
          title="Localizações"
          value={stats.countries}
          subtitle="países distintos"
          icon={Globe}
        />
      </div>

      {/* Login Map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Mapa de Logins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoginMap sessions={sessions} />
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Sessões Ativas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SessionsTable sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  );
}

export default TenantSessionDashboard;
