import { useState, useMemo, useEffect, useRef } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Car, AlertTriangle, MapPin, Gauge, Clock, Shield, Users, Activity, Wifi, WifiOff, RefreshCw, Maximize2, Minimize2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useFleetRealtime } from '@/hooks/fleet/useFleetRealtime';
import type { RealtimeEventType, ConnectionStatus } from '@/hooks/fleet/useFleetRealtime';
import { useFleetCache } from '@/hooks/fleet/useFleetCache';
import { useFleetSecurity } from '@/hooks/fleet/useFleetSecurity';
import { useTraccarFleet, type TraccarVehicle } from '@/hooks/fleet/useTraccarFleet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  harsh_brake: 'Frenagem Brusca',
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

// ── Map vehicle type for internal use ──
interface MapVehicle {
  device_id: string;
  plate: string;
  driver: string;
  lat: number;
  lng: number;
  speed: number;
  ignition: boolean;
  status: 'moving' | 'idle' | 'stopped' | 'speeding';
}

function traccarToMapVehicle(dev: TraccarVehicle): MapVehicle | null {
  if (dev.lat == null || dev.lng == null) return null;
  return {
    device_id: String(dev.id),
    plate: dev.name || dev.uniqueId,
    driver: (dev.attributes?.driver as string) || dev.phone || dev.name || '—',
    lat: dev.lat,
    lng: dev.lng,
    speed: dev.speed ?? 0,
    ignition: dev.ignition ?? false,
    status: dev.computedStatus ?? 'stopped',
  };
}

// ── Fleet Map (Leaflet) ──
function FleetMap({ vehicles, expanded, onToggleExpand }: { vehicles: MapVehicle[]; expanded?: boolean; onToggleExpand?: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    let map: L.Map | null = null;
    try {
      map = L.map(mapRef.current, {
        center: [-23.55, -46.63],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      const statusColor: Record<string, string> = {
        moving: '#22c55e',
        idle: '#f59e0b',
        stopped: '#6b7280',
        speeding: '#ef4444',
      };

      vehicles.forEach((v) => {
        const color = statusColor[v.status] || '#6b7280';
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${color};border:2px solid white;
            display:flex;align-items:center;justify-content:center;
            font-size:10px;font-weight:700;color:white;
            box-shadow:0 2px 8px rgba(0,0,0,0.4);
          ">${v.speed}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([v.lat, v.lng], { icon }).addTo(map!)
          .bindPopup(`
            <div style="font-size:12px;line-height:1.6">
              <strong>${v.plate}</strong> — ${v.driver}<br/>
              Velocidade: <strong>${v.speed} km/h</strong><br/>
              Status: <strong>${v.status}</strong><br/>
              Ignição: ${v.ignition ? '🟢 Ligada' : '⚪ Desligada'}
            </div>
          `);
      });

      leafletRef.current = map;
    } catch (err) {
      console.error('[FleetMap] Leaflet init error:', err);
    }

    return () => {
      if (map) {
        map.remove();
        leafletRef.current = null;
      }
    };
  }, [vehicles]);

  // Invalidate map size when expanded changes
  useEffect(() => {
    if (leafletRef.current) {
      setTimeout(() => leafletRef.current?.invalidateSize(), 300);
    }
  }, [expanded]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full rounded-lg" />
      {onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className="absolute top-2 right-2 z-[1000] p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
          title={expanded ? 'Reduzir mapa' : 'Expandir mapa'}
        >
          {expanded ? <Minimize2 className="h-4 w-4 text-foreground" /> : <Maximize2 className="h-4 w-4 text-foreground" />}
        </button>
      )}
    </div>
  );
}

export default function FleetDashboard() {
  const [mapExpanded, setMapExpanded] = useState(false);
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  // Traccar real data
  const { vehicles: traccarVehicles, isConfigured: traccarConfigured } = useTraccarFleet({
    tenantId,
    pollIntervalMs: 15_000,
    useCache: true,
  });

  const mapVehicles = useMemo<MapVehicle[]>(() => {
    try {
      return traccarVehicles.map(traccarToMapVehicle).filter((v): v is MapVehicle => v !== null);
    } catch (err) {
      console.error('[FleetDashboard] mapVehicles error:', err);
      return [];
    }
  }, [traccarVehicles]);

  const { events, status, refresh } = useFleetRealtime({
    eventTypes: SUBSCRIBED_TYPES,
    tenantId,
    maxEvents: 100,
    enabled: !!tenantId,
  });

  const fleetCache = useFleetCache({
    tenantId: tenantId ?? '',
    enabled: !!tenantId,
  });

  const { filterByAccess } = useFleetSecurity();

  const realBehavior = useMemo(() => filterByAccess(events.behavior?.items ?? []), [events.behavior, filterByAccess]);
  const realIncidents = useMemo(() => filterByAccess(events.compliance_incident?.items ?? []), [events.compliance_incident, filterByAccess]);

  const behaviorEvents = realBehavior;
  const incidents = realIncidents;
  const latestEvents = mapVehicles;

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
          {!traccarConfigured && (
            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
              Traccar não configurado
            </Badge>
          )}
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
        <StatsCard title="Veículos Rastreados" value={latestEvents.length} icon={Car} />
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
      <div className={cn("grid gap-6", mapExpanded ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
        <Card className={mapExpanded ? "col-span-full" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <MapPin className="h-5 w-5" />
              Mapa em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("rounded-lg overflow-hidden transition-all duration-300", mapExpanded ? "h-[600px]" : "h-[300px]")}>
              <FleetMap vehicles={mapVehicles} expanded={mapExpanded} onToggleExpand={() => setMapExpanded(e => !e)} />
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
                  <TableCell className="font-medium">{entry.employee_id}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
