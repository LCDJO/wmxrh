/**
 * FleetLiveView — Interactive live map with vehicles, speed, alerts.
 * Uses plain Leaflet for React 18 compatibility.
 * Real Traccar data with mock fallback when not configured.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pause, Play, Search, Car, AlertTriangle, Gauge, MapPin, Wifi, WifiOff,
  Filter, Navigation, Zap, Clock, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventDetailPanel, type EventDetail } from '@/components/fleet/EventDetailPanel';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { useTraccarFleet, type TraccarVehicle } from '@/hooks/useTraccarFleet';

// ── Unified Vehicle type ──
interface FleetVehicle {
  id: string;
  plate: string;
  driver: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  ignition: boolean;
  status: 'moving' | 'idle' | 'stopped' | 'speeding';
  lastUpdate: Date;
  address?: string | null;
}

interface FleetAlert {
  id: string;
  type: 'overspeed' | 'harsh_brake' | 'route_deviation' | 'geofence' | 'idle_excess';
  vehicleId: string;
  plate: string;
  driver: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  speed?: number;
  limit?: number;
}

// ── Map Traccar devices to FleetVehicle ──
function traccarToFleetVehicle(dev: TraccarVehicle): FleetVehicle | null {
  if (dev.lat == null || dev.lng == null) return null;
  return {
    id: String(dev.id),
    plate: dev.name || dev.uniqueId,
    driver: dev.attributes?.driver as string || dev.phone || dev.name || '—',
    lat: dev.lat,
    lng: dev.lng,
    speed: dev.speed ?? 0,
    heading: dev.course ?? 0,
    ignition: dev.ignition ?? false,
    status: dev.computedStatus ?? 'stopped',
    lastUpdate: dev.lastUpdate ? new Date(dev.lastUpdate) : new Date(),
    address: dev.address,
  };
}

function generateAlertsFromVehicles(vehicles: FleetVehicle[]): FleetAlert[] {
  const alerts: FleetAlert[] = [];
  vehicles.forEach(v => {
    if (v.status === 'speeding') {
      alerts.push({
        id: `alert-speed-${v.id}`,
        type: 'overspeed',
        vehicleId: v.id,
        plate: v.plate,
        driver: v.driver,
        message: `${v.plate} a ${v.speed}km/h — limite: 80km/h`,
        severity: v.speed > 100 ? 'critical' : 'high',
        timestamp: v.lastUpdate,
        speed: v.speed,
        limit: 80,
      });
    }
    if (v.status === 'idle' && v.ignition) {
      alerts.push({
        id: `alert-idle-${v.id}`,
        type: 'idle_excess',
        vehicleId: v.id,
        plate: v.plate,
        driver: v.driver,
        message: `Ociosidade excessiva — ${v.plate}`,
        severity: 'medium',
        timestamp: v.lastUpdate,
      });
    }
  });
  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ── Constants ──
const STATUS_COLORS: Record<string, string> = {
  speeding: '#ef4444',
  moving: '#22c55e',
  idle: '#f59e0b',
  stopped: '#6b7280',
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; badge: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  low: { bg: 'bg-blue-500/10', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

const TYPE_LABELS: Record<string, string> = {
  overspeed: 'Excesso Velocidade',
  harsh_brake: 'Freada Brusca',
  route_deviation: 'Desvio de Rota',
  geofence: 'Geofence',
  idle_excess: 'Ociosidade',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  moving: { label: 'Em movimento', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  speeding: { label: 'Excesso', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  idle: { label: 'Ocioso', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  stopped: { label: 'Parado', color: 'bg-muted text-muted-foreground border-border' },
};

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
  return `${Math.floor(s / 3600)}h atrás`;
}

function makeVehicleIcon(status: FleetVehicle['status']) {
  const color = STATUS_COLORS[status];
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.3),0 0 10px ${color}60;
      display:flex;align-items:center;justify-content:center;
    "><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L17 10l-2-4H7L5 10l-3.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════

export default function FleetLiveView() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  const {
    vehicles: traccarVehicles,
    loading: traccarLoading,
    error: traccarError,
    isConfigured,
    refresh,
    lastUpdate,
  } = useTraccarFleet({ tenantId, pollIntervalMs: 10_000 });

  // Map Traccar data to fleet vehicles
  const vehicles = useMemo<FleetVehicle[]>(() => {
    return traccarVehicles
      .map(traccarToFleetVehicle)
      .filter((v): v is FleetVehicle => v !== null);
  }, [traccarVehicles]);

  const alerts = useMemo(() => generateAlertsFromVehicles(vehicles), [vehicles]);

  const [isPaused, setIsPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const { toast } = useToast();

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // ── Initialize Leaflet map ──
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [-23.55, -46.63],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Fit bounds when vehicles first load
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (vehicles.length > 0 && leafletMap.current && !hasFittedRef.current) {
      const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng] as L.LatLngTuple));
      leafletMap.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      hasFittedRef.current = true;
    }
  }, [vehicles]);

  // ── Update markers on map ──
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    const q = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? vehicles.filter(v => v.plate.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q))
      : vehicles;

    const activeIds = new Set(filtered.map(v => v.id));

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    filtered.forEach(v => {
      const popupContent = `
        <div style="min-width:170px;font-family:sans-serif">
          <p style="font-weight:700;font-size:15px;margin:0">${v.plate}</p>
          <p style="color:#666;margin:2px 0">${v.driver}</p>
          <hr style="margin:6px 0;border-color:#eee"/>
          <p style="margin:2px 0"><b>Velocidade:</b> ${v.speed} km/h</p>
          <p style="margin:2px 0"><b>Ignição:</b> ${v.ignition ? '🟢 Ligada' : '⚪ Desligada'}</p>
          <p style="margin:2px 0"><b>Status:</b> ${STATUS_LABELS[v.status]?.label}</p>
          ${v.address ? `<p style="margin:2px 0;font-size:11px;color:#999">${v.address}</p>` : ''}
          <p style="color:#999;font-size:11px;margin-top:6px">${timeAgo(v.lastUpdate)}</p>
        </div>
      `;

      const existing = markersRef.current.get(v.id);
      if (existing) {
        existing.setLatLng([v.lat, v.lng]);
        existing.setIcon(makeVehicleIcon(v.status));
        existing.setPopupContent(popupContent);
      } else {
        const marker = L.marker([v.lat, v.lng], { icon: makeVehicleIcon(v.status) })
          .addTo(map)
          .bindPopup(popupContent);
        marker.on('click', () => setSelectedVehicle(v.id));
        markersRef.current.set(v.id, marker);
      }
    });
  }, [vehicles, searchTerm]);

  // ── Fly to selected vehicle ──
  useEffect(() => {
    if (!selectedVehicle || !leafletMap.current) return;
    const v = vehicles.find(x => x.id === selectedVehicle);
    if (v) leafletMap.current.flyTo([v.lat, v.lng], 15, { duration: 0.8 });
  }, [selectedVehicle, vehicles]);

  // Filters
  const filteredVehicles = useMemo(() => {
    if (!searchTerm) return vehicles;
    const q = searchTerm.toLowerCase();
    return vehicles.filter(v => v.plate.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q));
  }, [vehicles, searchTerm]);

  const filteredAlerts = useMemo(() => {
    let filtered = alerts;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(a => a.plate.toLowerCase().includes(q) || a.driver.toLowerCase().includes(q));
    }
    if (eventFilter !== 'all') filtered = filtered.filter(a => a.type === eventFilter);
    return filtered;
  }, [alerts, searchTerm, eventFilter]);

  const stats = useMemo(() => ({
    total: vehicles.length,
    moving: vehicles.filter(v => v.status === 'moving').length,
    speeding: vehicles.filter(v => v.status === 'speeding').length,
    idle: vehicles.filter(v => v.status === 'idle').length,
    stopped: vehicles.filter(v => v.status === 'stopped').length,
    criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
  }), [vehicles, alerts]);

  const selectedData = selectedVehicle ? vehicles.find(v => v.id === selectedVehicle) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            Live View — Rastreamento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoramento em tempo real da frota
            {!isConfigured && ' · Traccar não configurado'}
            {lastUpdate && ` · Atualizado ${timeAgo(lastUpdate)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isConfigured && (
            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
              <WifiOff className="h-3 w-3 mr-1" /> Sem integração
            </Badge>
          )}
          {isConfigured && (
            <div className={cn("flex items-center gap-1.5 text-xs font-medium text-emerald-500")}>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="h-3.5 w-3.5" />
              Ao vivo
            </div>
          )}
          <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {traccarError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {traccarError}
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Car, color: 'text-primary' },
          { label: 'Em Movimento', value: stats.moving, icon: Navigation, color: 'text-emerald-500' },
          { label: 'Excesso', value: stats.speeding, icon: Gauge, color: 'text-destructive' },
          { label: 'Ociosos', value: stats.idle, icon: Clock, color: 'text-amber-500' },
          { label: 'Parados', value: stats.stopped, icon: MapPin, color: 'text-muted-foreground' },
          { label: 'Alertas Críticos', value: stats.criticalAlerts, icon: AlertTriangle, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filtrar por nome ou ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="overspeed">Excesso Velocidade</SelectItem>
            <SelectItem value="harsh_brake">Freada Brusca</SelectItem>
            <SelectItem value="route_deviation">Desvio de Rota</SelectItem>
            <SelectItem value="geofence">Geofence</SelectItem>
            <SelectItem value="idle_excess">Ociosidade</SelectItem>
          </SelectContent>
        </Select>
        {searchTerm && <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>Limpar filtro</Button>}
      </div>

      {/* No data message */}
      {!traccarLoading && vehicles.length === 0 && !traccarError && (
        <Card className="border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Car className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {isConfigured
                ? 'Nenhum dispositivo com posição encontrado. Verifique se os dispositivos estão enviando dados ao Traccar.'
                : 'Configure a integração com o Traccar nas configurações do tenant para ver os dispositivos.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 520 }}>
        {/* Map */}
        <Card className="lg:col-span-2 overflow-hidden border-border relative">
          <div ref={mapRef} className="h-[520px] w-full" />
          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg p-2.5 border border-border z-[1000] text-xs space-y-1">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Em movimento</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-destructive" /> Excesso</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500" /> Ocioso</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted-foreground" /> Parado</div>
          </div>
        </Card>

        {/* Vehicle list / Selected detail */}
        <div className="flex flex-col gap-4">
          {selectedData && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    {selectedData.plate}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedVehicle(null)}>✕</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">{selectedData.driver}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-foreground">{selectedData.speed}</p>
                    <p className="text-[10px] text-muted-foreground">km/h</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-foreground">{selectedData.heading}°</p>
                    <p className="text-[10px] text-muted-foreground">Direção</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_LABELS[selectedData.status]?.color}>
                    {STATUS_LABELS[selectedData.status]?.label}
                  </Badge>
                  <Badge variant="outline">{selectedData.ignition ? '🟢 Ligada' : '⚪ Desligada'}</Badge>
                </div>
                {selectedData.address && (
                  <p className="text-xs text-muted-foreground">{selectedData.address}</p>
                )}
                <p className="text-xs text-muted-foreground">Atualizado: {timeAgo(selectedData.lastUpdate)}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedData.lat.toFixed(5)}, {selectedData.lng.toFixed(5)}</p>
              </CardContent>
            </Card>
          )}

          <Card className="flex-1 min-h-0 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-card-foreground">
                <Car className="h-4 w-4" />
                Veículos ({filteredVehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
                {filteredVehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicle(v.id)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between",
                      selectedVehicle === v.id && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0",
                        v.status === 'speeding' ? 'bg-destructive' :
                        v.status === 'moving' ? 'bg-emerald-500' :
                        v.status === 'idle' ? 'bg-amber-500' : 'bg-muted-foreground'
                      )} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{v.plate}</p>
                        <p className="text-xs text-muted-foreground">{v.driver}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold", v.speed > 80 ? 'text-destructive' : 'text-foreground')}>{v.speed} km/h</p>
                      <p className="text-[10px] text-muted-foreground">{timeAgo(v.lastUpdate)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alerts feed */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <AlertTriangle className="h-5 w-5" />
              Alertas em Tempo Real
              {isConfigured && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />}
            </CardTitle>
            <Badge variant="outline" className="text-xs">{filteredAlerts.length} alertas</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhum alerta com os filtros atuais</p>
            ) : (
              filteredAlerts.slice(0, 20).map(a => {
                const style = SEVERITY_STYLES[a.severity];
                return (
                  <button
                    key={a.id}
                    className={cn("w-full text-left flex items-center justify-between rounded-lg p-3 border", style.bg, "border-border")}
                    onClick={() => {
                      const v = vehicles.find(x => x.id === a.vehicleId);
                      setSelectedVehicle(a.vehicleId);
                      setSelectedEvent({
                        id: a.id,
                        type: a.type,
                        plate: a.plate,
                        driver: a.driver,
                        vehicleId: a.vehicleId,
                        severity: a.severity,
                        message: a.message,
                        timestamp: a.timestamp,
                        lat: v?.lat ?? -23.55,
                        lng: v?.lng ?? -46.63,
                        speed: a.speed,
                        limit: a.limit,
                        heading: v?.heading,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Zap className={cn("h-4 w-4 shrink-0", style.text)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.message}</p>
                        <p className="text-xs text-muted-foreground">{a.driver} · {timeAgo(a.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={cn("text-[10px]", style.badge)}>{TYPE_LABELS[a.type]}</Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Panel */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onAction={(action, evt) => {
          const labels: Record<string, string> = {
            warning: 'Advertência emitida',
            task: 'Tarefa criada',
            training: 'Treinamento solicitado',
            block: 'Operação bloqueada',
          };
          toast({ title: labels[action] ?? action, description: `${evt.driver} — ${evt.plate}` });
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
