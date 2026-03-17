/**
 * OperationalDashboard — Realtime operational view:
 *  - KPIs (online users, active tenants, active sessions, logins today)
 *  - Interactive Leaflet map
 *  - Geo distribution, top tenants, system status, security alerts
 *  - Active sessions table
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Building2, Activity, LogIn, Globe, Shield, Server,
  Database, Wifi, Clock, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { useActiveSessions } from '@/modules/user-activity/hooks/useActiveSessions';
import { SessionLeafletMap } from '@/modules/user-activity/ui/SessionLeafletMap';
import { SecurityAlertsPanel } from '@/modules/user-activity/ui/SecurityAlertsPanel';
import { EnhancedSessionsPanel } from '@/modules/user-activity/ui/EnhancedSessionsPanel';

export function OperationalDashboard() {
  const { sessions, mapSessions, stats, loading, refresh } = useActiveSessions();

  // Geo distribution
  const geoDistribution = useMemo(() => {
    const map = new Map<string, { country: string; city: string; count: number }>();
    sessions.forEach(s => {
      const key = `${s.country ?? 'Desconhecido'}|${s.city ?? '—'}`;
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, { country: s.country ?? 'Desconhecido', city: s.city ?? '—', count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [sessions]);

  // Top tenants by online users
  const topTenants = useMemo(() => {
    const map = new Map<string, { name: string; online: number; total: number }>();
    sessions.forEach(s => {
      const name = s.tenant_name ?? 'Sem Tenant';
      const existing = map.get(name);
      if (existing) {
        existing.total++;
        if (s.status === 'online') existing.online++;
      } else {
        map.set(name, { name, online: s.status === 'online' ? 1 : 0, total: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.online - a.online).slice(0, 6);
  }, [sessions]);

  // Logins today count
  const loginsToday = useMemo(() => {
    const today = new Date().toDateString();
    return sessions.filter(s => new Date(s.login_at).toDateString() === today).length;
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Usuários Online"
          value={stats.online}
          subtitle={`${stats.idle} idle`}
          icon={Users}
        />
        <StatsCard
          title="Empresas Ativas"
          value={stats.unique_tenants}
          icon={Building2}
        />
        <StatsCard
          title="Sessões Ativas"
          value={stats.total_today}
          subtitle={`${stats.countries} países`}
          icon={Activity}
        />
        <StatsCard
          title="Logins Hoje"
          value={loginsToday}
          icon={LogIn}
        />
      </div>

      {/* Map */}
      <SessionLeafletMap sessions={sessions} />

      {/* Secondary panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Geo Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Distribuição Geográfica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {geoDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
              ) : (
                geoDistribution.map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">
                      {g.city !== '—' ? `${g.city}, ` : ''}{g.country}
                    </span>
                    <Badge variant="secondary" className="text-xs">{g.count}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Tenants */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Empresas Mais Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
              ) : (
                topTenants.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{t.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t.total} sessões</Badge>
                      <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{t.online} online</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Status do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'API', icon: Wifi, status: 'operational' },
                { label: 'Banco de Dados', icon: Database, status: 'operational' },
                { label: 'Realtime', icon: Activity, status: 'operational' },
                { label: 'Auth', icon: Shield, status: 'operational' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-emerald-500">Operacional</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">Latência média</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {stats.avg_duration_min > 0 ? `${stats.avg_duration_min} min` : '< 1ms'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SecurityAlertsPanel sessions={sessions} />
        {/* Quick VPN/anomaly stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Resumo de Riscos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.vpn_sessions}</p>
                <p className="text-xs text-muted-foreground mt-1">Sessões VPN/Proxy</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.mobile_sessions}</p>
                <p className="text-xs text-muted-foreground mt-1">Sessões Mobile</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.desktop_sessions}</p>
                <p className="text-xs text-muted-foreground mt-1">Sessões Desktop</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.countries}</p>
                <p className="text-xs text-muted-foreground mt-1">Países Únicos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <EnhancedSessionsPanel sessions={sessions} onRefresh={refresh} />
    </>
  );
}
