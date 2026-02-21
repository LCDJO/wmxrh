import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Car, AlertTriangle, MapPin, Gauge, Clock, Shield, Users, Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

export default function FleetDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  // Devices
  const { data: devices = [] } = useQuery({
    queryKey: ['fleet-devices', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('fleet_devices')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Behavior events (last 30 days)
  const { data: behaviorEvents = [] } = useQuery({
    queryKey: ['fleet-behavior-events', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from('fleet_behavior_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('event_timestamp', thirtyDaysAgo.toISOString())
        .order('event_timestamp', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Incidents
  const { data: incidents = [] } = useQuery({
    queryKey: ['fleet-incidents', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('fleet_compliance_incidents')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Latest tracking events (for map placeholder)
  const { data: latestEvents = [] } = useQuery({
    queryKey: ['fleet-latest-events', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('raw_tracking_events')
        .select('device_id, latitude, longitude, speed, ignition, event_timestamp')
        .eq('tenant_id', tenantId)
        .order('event_timestamp', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Stats
  const stats = useMemo(() => {
    const activeDevices = devices.filter((d: any) => d.is_active).length;
    const totalViolations = behaviorEvents.length;
    const activeAlerts = incidents.filter((i: any) => i.status === 'pending').length;
    const criticalCount = behaviorEvents.filter((e: any) => e.severity === 'critical').length;
    return { activeDevices, totalViolations, activeAlerts, criticalCount };
  }, [devices, behaviorEvents, incidents]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Fleet Compliance Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitoramento de frota, infrações e alertas em tempo real</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Dispositivos Ativos" value={stats.activeDevices} icon={Car} />
        <StatsCard title="Infrações (30d)" value={stats.totalViolations} icon={AlertTriangle} />
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
                Nenhuma infração registrada nos últimos 30 dias
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
