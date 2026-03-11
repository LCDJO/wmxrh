/**
 * LiveUsersPanel — Real-time dashboard for live user sessions.
 * Widgets: online users, sessions by tenant, top countries, devices.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Users, Globe, Monitor, Smartphone, MapPin, Clock,
  RefreshCw, Building2, Shield, Eye, Laptop, Map,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import KDEWorldMap from './KDEWorldMap';
import {
  fetchActiveSessions,
  fetchRecentSessions,
  computePresenceSummary,
  usePresenceRealtime,
} from '@/domains/user-presence';
import type { ActiveSession, PresenceSummary } from '@/domains/user-presence';

export default function LiveUsersPanel() {
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [summary, setSummary] = useState<PresenceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [activeSessions, recentSessions] = await Promise.all([
      fetchActiveSessions(),
      fetchRecentSessions(24),
    ]);
    setActive(activeSessions);
    setSummary(computePresenceSummary(activeSessions, recentSessions));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePresenceRealtime(load);

  // Tenant breakdown
  const tenantMap: Record<string, number> = {};
  active.forEach(s => {
    const key = s.tenant_id ?? 'sem_tenant';
    tenantMap[key] = (tenantMap[key] ?? 0) + 1;
  });
  const tenantEntries = Object.entries(tenantMap).sort(([, a], [, b]) => b - a);

  // Country breakdown
  const countryMap: Record<string, number> = {};
  active.forEach(s => {
    const key = s.country ?? 'Desconhecido';
    countryMap[key] = (countryMap[key] ?? 0) + 1;
  });
  const countryEntries = Object.entries(countryMap).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" /> Usuários Online
        </h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={<Users className="h-4 w-4" />} label="Online" value={summary.total_online} accent="text-emerald-500" />
          <KPI icon={<Clock className="h-4 w-4" />} label="Idle" value={summary.total_idle} accent="text-amber-500" />
          <KPI icon={<Globe className="h-4 w-4" />} label="Países" value={summary.unique_countries} accent="text-blue-500" />
          <KPI icon={<Smartphone className="h-4 w-4" />} label="Mobile" value={`${summary.mobile_pct}%`} accent="text-purple-500" />
        </div>
      )}

      {/* KDE World Map */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="h-4 w-4 text-primary" /> Mapa de Densidade de Logins (KDE)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KDEWorldMap sessions={active} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sessions by Tenant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Sessões por Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px]">
              {tenantEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem sessões</p>
              ) : (
                <div className="space-y-2">
                  {tenantEntries.map(([tid, count]) => (
                    <div key={tid} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground truncate max-w-[140px]">
                        {tid === 'sem_tenant' ? '(sem tenant)' : tid.slice(0, 12) + '…'}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Top Countries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Top Países
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px]">
              <div className="space-y-2">
                {countryEntries.slice(0, 10).map(([country, count]) => {
                  const pct = active.length > 0 ? Math.round((count / active.length) * 100) : 0;
                  return (
                    <div key={country}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-foreground">{country}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" /> Dispositivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px]">
              {summary && (
                <div className="space-y-4">
                  <BreakdownSection title="Navegador" data={summary.browser_breakdown} total={active.length} />
                  <BreakdownSection title="Sistema" data={summary.os_breakdown} total={active.length} />
                  <BreakdownSection title="Tipo" data={summary.device_breakdown} total={active.length} />
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Live session list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Sessões Ativas ({active.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {active.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded border border-border/30 hover:bg-muted/20 transition-colors text-xs">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${s.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="font-mono text-muted-foreground w-[70px] truncate">{s.user_id.slice(0, 8)}…</span>
                  <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.city ?? '—'}</span>
                  <div className="text-muted-foreground flex flex-col">
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{s.ip_address ?? '—'}</span>
                    {(s as any).asn_name && <span className="text-[10px] text-muted-foreground/70 pl-4">{(s as any).asn_name}</span>}
                  </div>
                  <span className="text-muted-foreground flex items-center gap-1"><Monitor className="h-3 w-3" />{s.browser ?? '?'}/{s.os ?? '?'}</span>
                  <span className="text-muted-foreground flex items-center gap-1 ml-auto"><Clock className="h-3 w-3" />{new Date(s.last_activity).toLocaleTimeString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={accent}>{icon}</div>
        <div>
          <div className="text-lg font-bold text-foreground">{value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownSection({ title, data, total }: { title: string; data: Record<string, number>; total: number }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 5);
  const t = total || 1;
  return (
    <div>
      <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1">{title}</div>
      {entries.map(([name, count]) => (
        <div key={name} className="flex justify-between text-xs py-0.5">
          <span className="text-foreground">{name}</span>
          <span className="text-muted-foreground">{Math.round((count / t) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
