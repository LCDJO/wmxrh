/**
 * PlatformUserPresence — User Presence & Login Intelligence Dashboard
 */
import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Users, Globe, Monitor, Smartphone, Shield, Clock, MapPin,
  Activity, Eye, AlertTriangle, Wifi, RefreshCw, BarChart3,
  Laptop, KeyRound, TrendingUp,
} from 'lucide-react';
import {
  fetchActiveSessions,
  fetchRecentSessions,
  computePresenceSummary,
  computeLoginAnalytics,
  usePresenceRealtime,
} from '@/domains/user-presence';
import type { ActiveSession, PresenceSummary, LoginAnalytics } from '@/domains/user-presence';

export default function PlatformUserPresence() {
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [recent, setRecent] = useState<ActiveSession[]>([]);
  const [summary, setSummary] = useState<PresenceSummary | null>(null);
  const [analytics, setAnalytics] = useState<LoginAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [activeSessions, recentSessions] = await Promise.all([
      fetchActiveSessions(),
      fetchRecentSessions(24),
    ]);
    setActive(activeSessions);
    setRecent(recentSessions);
    setSummary(computePresenceSummary(activeSessions, recentSessions));
    setAnalytics(computeLoginAnalytics(recentSessions));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePresenceRealtime(load);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            User Presence & Login Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real de sessões, localização e dispositivos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPICard icon={<Users className="h-4 w-4" />} label="Online" value={summary.total_online} color="text-emerald-500" />
          <KPICard icon={<Clock className="h-4 w-4" />} label="Idle" value={summary.total_idle} color="text-amber-500" />
          <KPICard icon={<Activity className="h-4 w-4" />} label="Hoje" value={summary.total_today} color="text-primary" />
          <KPICard icon={<Globe className="h-4 w-4" />} label="Países" value={summary.unique_countries} color="text-blue-500" />
          <KPICard icon={<Smartphone className="h-4 w-4" />} label="Mobile %" value={`${summary.mobile_pct}%`} color="text-purple-500" />
          <KPICard icon={<Shield className="h-4 w-4" />} label="VPN %" value={`${summary.vpn_pct}%`} color="text-destructive" />
        </div>
      )}

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessões Ativas</TabsTrigger>
          <TabsTrigger value="map">Mapa de Presença</TabsTrigger>
          <TabsTrigger value="analytics">Login Analytics</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
        </TabsList>

        {/* ── Active Sessions ── */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />
                Sessões Ativas ({active.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {active.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      Nenhuma sessão ativa
                    </div>
                  ) : (
                    active.map(s => <SessionRow key={s.id} session={s} />)
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Geo Map ── */}
        <TabsContent value="map">
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground">Carregando mapa…</div>}>
            <LiveUserMapRenderer />
          </Suspense>
        </TabsContent>


        {/* ── Login Analytics ── */}
        <TabsContent value="analytics">
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Volume de Logins
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatRow label="Última hora" value={analytics.logins_last_1h} />
                  <StatRow label="Últimas 24h" value={analytics.logins_last_24h} />
                  <StatRow label="Últimos 7 dias" value={analytics.logins_last_7d} />
                  <StatRow label="Duração média (min)" value={analytics.avg_session_duration_min} />
                  <StatRow label="IPs únicos (24h)" value={analytics.unique_ips_24h} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatRow label="Horário pico" value={`${analytics.peak_hour}:00`} />
                  <StatRow label="SSO %" value={`${analytics.sso_pct}%`} />
                  <div className="pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      Sessões suspeitas (VPN/Proxy): {analytics.suspicious_sessions.length}
                    </div>
                    {analytics.suspicious_sessions.slice(0, 5).map(s => (
                      <div key={s.id} className="text-xs text-muted-foreground flex items-center gap-1.5 py-0.5">
                        <Shield className="h-3 w-3 text-amber-500" />
                        {s.ip_address ?? '—'} • {s.city ?? '?'} • {s.browser ?? '?'}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Devices ── */}
        <TabsContent value="devices">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BreakdownCard title="Navegadores" icon={<Globe className="h-4 w-4" />} data={summary.browser_breakdown} />
              <BreakdownCard title="Sistemas Operacionais" icon={<Monitor className="h-4 w-4" />} data={summary.os_breakdown} />
              <BreakdownCard title="Tipo de Dispositivo" icon={<Laptop className="h-4 w-4" />} data={summary.device_breakdown} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <div className="text-lg font-bold text-foreground">{value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionRow({ session }: { session: ActiveSession }) {
  const statusColor = session.status === 'online' ? 'bg-emerald-500' : session.status === 'idle' ? 'bg-amber-500' : 'bg-muted';
  const elapsed = session.last_activity
    ? Math.round((Date.now() - new Date(session.last_activity).getTime()) / 60_000)
    : null;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors text-sm">
      <div className={`h-2.5 w-2.5 rounded-full ${statusColor} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{session.user_id.slice(0, 8)}…</span>
          <Badge variant="outline" className="text-[9px] h-4">{session.login_method ?? 'password'}</Badge>
          {session.is_vpn && <Badge variant="destructive" className="text-[9px] h-4">VPN</Badge>}
          {session.is_mobile && <Badge variant="secondary" className="text-[9px] h-4">Mobile</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.city ?? '—'}, {session.country ?? '—'}</span>
          <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{session.ip_address ?? '—'}</span>
          <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{session.browser ?? '?'} / {session.os ?? '?'}</span>
          {elapsed !== null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{elapsed}m atrás</span>}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}

function BreakdownCard({ title, icon, data }: { title: string; icon: React.ReactNode; data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.slice(0, 8).map(([name, count]) => (
            <div key={name}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-foreground">{name}</span>
                <span className="text-muted-foreground">{count} ({Math.round((count / total) * 100)}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
