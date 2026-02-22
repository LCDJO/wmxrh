import { useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Car, AlertTriangle, MapPin, Gauge, Clock, Shield, Users, Activity, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useFleetRealtime } from '@/hooks/useFleetRealtime';
import type { RealtimeEventType, ConnectionStatus } from '@/hooks/useFleetRealtime';
import { useFleetCache } from '@/hooks/useFleetCache';
import { useFleetSecurity } from '@/hooks/useFleetSecurity';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SEVERITY_COLORS: Record<string, string> = {
  low: 'hsl(210, 100%, 52%)',
  medium: 'hsl(38, 92%, 50%)',
  high: 'hsl(25, 95%, 53%)',
  critical: 'hsl(0, 72%, 51%)',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  overspeed: 'Excesso de Velocidade',
  geofence_violation: 'Violação de Geofence',
  route_deviation: 'Desvio de Rota',
  after_hours_use: 'Uso Fora do Horário',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  reviewed: 'Revisado',
  warning_issued: 'Advertência Emitida',
  closed: 'Encerrado',
};

const STATUS_INDICATOR: Record<ConnectionStatus, { label: string; icon: any; color: string }> = {
  connecting: { label: 'Conectando...', icon: Wifi, color: 'text-amber-500' },
  connected: { label: 'Ao vivo', icon: Wifi, color: 'text-emerald-500' },
  disconnected: { label: 'Desconectado', icon: WifiOff, color: 'text-destructive' },
  polling: { label: 'Polling', icon: RefreshCw, color: 'text-amber-500' },
};

const SUBSCRIBED_TYPES: RealtimeEventType[] = ['tracking', 'behavior', 'compliance_incident', 'disciplinary', 'violation'];

export default function FleetDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  const { events, status, refresh } = useFleetRealtime({
    eventTypes: SUBSCRIBED_TYPES,
    tenantId,
    maxEvents: 100,
    enabled: !!tenantId,
  });

  // 24h cache layer for summary, top offenders, alerts
  const fleetCache = useFleetCache({
    tenantId: tenantId ?? '',
    enabled: !!tenantId,
  });

  // Security: Access Graph filtering + role-based visibility
  const { filterByAccess, filterEmployees, fleetContext, logAction } = useFleetSecurity();

  // Apply Access Graph filtering to realtime data
  const behaviorEvents = useMemo(() => filterByAccess(events.behavior?.items ?? []), [events.behavior, filterByAccess]);
  const incidents = useMemo(() => filterByAccess(events.compliance_incident?.items ?? []), [events.compliance_incident, filterByAccess]);
  const latestEvents = events.tracking?.items ?? [];

  // Stats
  const stats = useMemo(() => {
    const totalViolations = behaviorEvents.length;
    const activeAlerts = incidents.filter((i: any) => i.status === 'pending').length;
    const criticalCount = behaviorEvents.filter((e: any) => e.severity === 'critical').length;
    return { totalViolations, activeAlerts, criticalCount };
  }, [behaviorEvents, incidents]);

  // Violations by type (pie chart)
  const violationsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    behaviorEvents.forEach((e: any) => {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      name: EVENT_TYPE_LABELS[type] || type,
      value: count,
    }));
  }, [behaviorEvents]);

  // Ranking by employee (top 10)
  const rankingByEmployee = useMemo(() => {
    const counts: Record<string, { employee_id: string; total: number; critical: number }> = {};
    behaviorEvents.forEach((e: any) => {
      const eid = e.employee_id || 'Não identificado';
      if (!counts[eid]) counts[eid] = { employee_id: eid, total: 0, critical: 0 };
      counts[eid].total++;
      if (e.severity === 'critical') counts[eid].critical++;
    });
    return Object.values(counts)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [behaviorEvents]);

  // Violations by severity (bar chart)
  const violationsBySeverity = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    behaviorEvents.forEach((e: any) => {
      counts[e.severity] = (counts[e.severity] || 0) + 1;
    });
    return Object.entries(counts).map(([sev, count]) => ({
      name: SEVERITY_LABELS[sev] || sev,
      value: count,
      fill: SEVERITY_COLORS[sev],
    }));
  }, [behaviorEvents]);

  const PIE_COLORS = ['hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(210, 100%, 52%)', 'hsl(160, 84%, 29%)'];
  const connStatus = STATUS_INDICATOR[status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Fleet Compliance Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitoramento de frota, infrações e alertas em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-1.5 text-xs font-medium", connStatus.color)}>
            {status === 'connected' && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
            <connStatus.icon className="h-3.5 w-3.5" />
            {connStatus.label}
          </div>
          <Button size="sm" variant="ghost" onClick={() => { refresh(); fleetCache.invalidateAll(); }} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Eventos Rastreamento" value={latestEvents.length} icon={Car} />
        <StatsCard title="Infrações (Tempo Real)" value={stats.totalViolations} icon={AlertTriangle} />
        <StatsCard title="Alertas Pendentes" value={stats.activeAlerts} icon={Activity} />
        <StatsCard
          title="Infrações Críticas"
          value={stats.criticalCount}
          icon={Shield}
          className={stats.criticalCount > 0 ? 'border-destructive/50' : ''}
        />
      </div>

      {/* Map + Violations by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time map placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <MapPin className="h-5 w-5" />
              Mapa em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MapPin className="h-12 w-12 opacity-40" />
              <p className="text-sm font-medium">Mapa será integrado com Traccar</p>
              <p className="text-xs">{latestEvents.length} posições recentes rastreadas</p>
              {latestEvents.length > 0 && (
                <div className="text-xs space-y-1 mt-2 max-h-[120px] overflow-y-auto w-full px-4">
                  {latestEvents.slice(0, 5).map((evt: any, i: number) => (
                    <div key={i} className="flex justify-between bg-background/50 rounded px-2 py-1">
                      <span className="font-mono">{evt.device_id}</span>
                      <span>{evt.speed?.toFixed(0)} km/h</span>
                      <span className={evt.ignition ? 'text-accent-foreground' : 'text-muted-foreground'}>
                        {evt.ignition ? '🟢' : '⚪'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Violations by type pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Gauge className="h-5 w-5" />
              Infrações por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {violationsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={violationsByType}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {violationsByType.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhuma infração registrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Severity bar chart + Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-card-foreground">Infrações por Gravidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={violationsBySeverity}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {violationsBySeverity.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <AlertTriangle className="h-5 w-5" />
              Alertas Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.filter((i: any) => i.status === 'pending').length > 0 ? (
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {incidents
                  .filter((i: any) => i.status === 'pending')
                  .slice(0, 10)
                  .map((incident: any) => (
                    <div key={incident.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {EVENT_TYPE_LABELS[incident.violation_type] || incident.violation_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Dispositivo: {incident.device_id}
                        </p>
                      </div>
                      <Badge variant={incident.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {SEVERITY_LABELS[incident.severity] || incident.severity}
                      </Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum alerta pendente
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking by employee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Users className="h-5 w-5" />
            Ranking de Infrações por Colaborador
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rankingByEmployee.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Críticas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingByEmployee.map((entry, i) => (
                  <TableRow key={entry.employee_id}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {entry.employee_id === 'Não identificado'
                        ? 'Não identificado'
                        : entry.employee_id.slice(0, 8) + '...'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{entry.total}</TableCell>
                    <TableCell className="text-right">
                      {entry.critical > 0 ? (
                        <Badge variant="destructive">{entry.critical}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhuma infração registrada para ranking
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Clock className="h-5 w-5" />
            Incidentes Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Gravidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.slice(0, 15).map((incident: any) => (
                  <TableRow key={incident.id}>
                    <TableCell>{EVENT_TYPE_LABELS[incident.violation_type] || incident.violation_type}</TableCell>
                    <TableCell className="font-mono text-sm">{incident.device_id}</TableCell>
                    <TableCell>
                      <Badge variant={incident.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {SEVERITY_LABELS[incident.severity] || incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {STATUS_LABELS[incident.status] || incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(incident.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum incidente registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
