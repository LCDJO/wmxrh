/**
 * FleetLiveView — Interactive live map with vehicles, speed, alerts.
 * Uses plain Leaflet (no react-leaflet) for React 18 compatibility.
 * Mock data until Traccar integration provides real positions.
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
  Pause, Play, Search, Car, AlertTriangle, Gauge, MapPin, Wifi,
  Filter, Navigation, Zap, Clock, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──
interface MockVehicle {
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
}

interface MockAlert {
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

// ── Mock data generator ──
function generateMockVehicles(): MockVehicle[] {
  const baseLat = -23.55;
  const baseLng = -46.63;
  const drivers = [
    'João Silva', 'Maria Santos', 'Carlos Lima', 'Ana Costa', 'Pedro Alves',
    'Fernanda Reis', 'Lucas Mendes', 'Roberto Dias', 'Juliana Ferreira', 'Rafael Oliveira',
    'Patrícia Gomes', 'Bruno Souza', 'Camila Rodrigues', 'Diego Pereira', 'Larissa Martins',
  ];

  return drivers.map((driver, i) => {
    const angle = (i / drivers.length) * Math.PI * 2;
    const radius = 0.02 + Math.random() * 0.06;
    const speed = Math.random() > 0.3 ? Math.floor(Math.random() * 120) : 0;
    const status: MockVehicle['status'] =
      speed > 80 ? 'speeding' : speed > 5 ? 'moving' : speed > 0 ? 'idle' : 'stopped';

    return {
      id: `v${i + 1}`,
      plate: `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 3) % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}-${String(1000 + i * 111).slice(0, 4)}`,
      driver,
      lat: baseLat + Math.cos(angle) * radius + (Math.random() - 0.5) * 0.01,
      lng: baseLng + Math.sin(angle) * radius + (Math.random() - 0.5) * 0.01,
      speed,
      heading: Math.floor(Math.random() * 360),
      ignition: speed > 0 || Math.random() > 0.3,
      status,
      lastUpdate: new Date(Date.now() - Math.floor(Math.random() * 60000)),
    };
  });
}

function generateMockAlerts(vehicles: MockVehicle[]): MockAlert[] {
  const alerts: MockAlert[] = [];
  const types: MockAlert['type'][] = ['overspeed', 'harsh_brake', 'route_deviation', 'geofence', 'idle_excess'];
  const severities: MockAlert['severity'][] = ['low', 'medium', 'high', 'critical'];
  const messages: Record<MockAlert['type'], string> = {
    overspeed: 'Excesso de velocidade detectado',
    harsh_brake: 'Frenagem brusca registrada',
    route_deviation: 'Desvio de rota detectado',
    geofence: 'Violação de geofence',
    idle_excess: 'Tempo ocioso excessivo',
  };

  vehicles.forEach((v, i) => {
    if (v.status === 'speeding') {
      alerts.push({
        id: `a${alerts.length}`,
        type: 'overspeed',
        vehicleId: v.id,
        plate: v.plate,
        driver: v.driver,
        message: `${v.plate} a ${v.speed}km/h — limite: 80km/h`,
        severity: v.speed > 100 ? 'critical' : 'high',
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 300000)),
        speed: v.speed,
        limit: 80,
      });
    }
    if (i % 4 === 0) {
      const type = types[Math.floor(Math.random() * types.length)];
      alerts.push({
        id: `a${alerts.length}`,
        type,
        vehicleId: v.id,
        plate: v.plate,
        driver: v.driver,
        message: `${messages[type]} — ${v.plate}`,
        severity: severities[Math.floor(Math.random() * severities.length)],
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 600000)),
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

function makeVehicleIcon(status: MockVehicle['status']) {
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
  const [vehicles, setVehicles] = useState<MockVehicle[]>(() => generateMockVehicles());
  const [alerts, setAlerts] = useState<MockAlert[]>(() => generateMockAlerts(vehicles));
  const [isPaused, setIsPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

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

    // Fit bounds to initial vehicles
    if (vehicles.length > 0) {
      const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

    return () => {
      map.remove();
      leafletMap.current = null;
      markersRef.current.clear();
    };
  }, []);

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
      const existing = markersRef.current.get(v.id);
      if (existing) {
        existing.setLatLng([v.lat, v.lng]);
        existing.setIcon(makeVehicleIcon(v.status));
        existing.setPopupContent(`
          <div style="min-width:170px;font-family:sans-serif">
            <p style="font-weight:700;font-size:15px;margin:0">${v.plate}</p>
            <p style="color:#666;margin:2px 0">${v.driver}</p>
            <hr style="margin:6px 0;border-color:#eee"/>
            <p style="margin:2px 0"><b>Velocidade:</b> ${v.speed} km/h</p>
            <p style="margin:2px 0"><b>Ignição:</b> ${v.ignition ? '🟢 Ligada' : '⚪ Desligada'}</p>
            <p style="margin:2px 0"><b>Status:</b> ${STATUS_LABELS[v.status]?.label}</p>
            <p style="color:#999;font-size:11px;margin-top:6px">${timeAgo(v.lastUpdate)}</p>
          </div>
        `);
      } else {
        const marker = L.marker([v.lat, v.lng], { icon: makeVehicleIcon(v.status) })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:170px;font-family:sans-serif">
              <p style="font-weight:700;font-size:15px;margin:0">${v.plate}</p>
              <p style="color:#666;margin:2px 0">${v.driver}</p>
              <hr style="margin:6px 0;border-color:#eee"/>
              <p style="margin:2px 0"><b>Velocidade:</b> ${v.speed} km/h</p>
              <p style="margin:2px 0"><b>Ignição:</b> ${v.ignition ? '🟢 Ligada' : '⚪ Desligada'}</p>
              <p style="margin:2px 0"><b>Status:</b> ${STATUS_LABELS[v.status]?.label}</p>
              <p style="color:#999;font-size:11px;margin-top:6px">${timeAgo(v.lastUpdate)}</p>
            </div>
          `);
        marker.on('click', () => setSelectedVehicle(v.id));
        markersRef.current.set(v.id, marker);
      }
    });
  }, [vehicles, searchTerm]);

  // ── Simulate real-time updates ──
  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setVehicles(prev => {
        const updated = prev.map(v => {
          if (v.status === 'stopped' && Math.random() > 0.9) return v;
          const dLat = (Math.random() - 0.5) * 0.002;
          const dLng = (Math.random() - 0.5) * 0.002;
          const newSpeed = Math.max(0, v.speed + (Math.random() - 0.5) * 20);
          const status: MockVehicle['status'] =
            newSpeed > 80 ? 'speeding' : newSpeed > 5 ? 'moving' : newSpeed > 0 ? 'idle' : 'stopped';
          return { ...v, lat: v.lat + dLat, lng: v.lng + dLng, speed: Math.floor(newSpeed), heading: (v.heading + (Math.random() - 0.5) * 30 + 360) % 360, status, lastUpdate: new Date() };
        });

        // Random new alert
        if (Math.random() > 0.7) {
          const rv = updated[Math.floor(Math.random() * updated.length)];
          const types: MockAlert['type'][] = ['overspeed', 'harsh_brake', 'route_deviation', 'geofence', 'idle_excess'];
          const type = types[Math.floor(Math.random() * types.length)];
          const sev: MockAlert['severity'][] = ['low', 'medium', 'high', 'critical'];
          const msgs: Record<string, string> = {
            overspeed: `${rv.plate} a ${rv.speed}km/h`,
            harsh_brake: `Frenagem brusca — ${rv.plate}`,
            route_deviation: `Desvio de rota — ${rv.plate}`,
            geofence: `Saída de geofence — ${rv.plate}`,
            idle_excess: `Ociosidade excessiva — ${rv.plate}`,
          };
          setAlerts(prev => [{
            id: `a${Date.now()}`, type, vehicleId: rv.id, plate: rv.plate, driver: rv.driver,
            message: msgs[type], severity: sev[Math.floor(Math.random() * sev.length)], timestamp: new Date(),
            speed: type === 'overspeed' ? rv.speed : undefined, limit: type === 'overspeed' ? 80 : undefined,
          }, ...prev].slice(0, 50));
        }

        return updated;
      });
    }, 3000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused]);

  // ── Fly to selected vehicle ──
  useEffect(() => {
    if (!selectedVehicle || !leafletMap.current) return;
    const v = vehicles.find(x => x.id === selectedVehicle);
    if (v) leafletMap.current.flyTo([v.lat, v.lng], 15, { duration: 0.8 });
  }, [selectedVehicle]);

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
          <p className="text-muted-foreground text-sm mt-1">Monitoramento em tempo real da frota · Dados simulados</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 text-xs font-medium", isPaused ? "text-amber-500" : "text-emerald-500")}>
            <span className={cn("h-2 w-2 rounded-full", isPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse")} />
            <Wifi className="h-3.5 w-3.5" />
            {isPaused ? 'Pausado' : 'Ao vivo'}
          </div>
          <Button size="sm" variant={isPaused ? 'default' : 'outline'} onClick={() => setIsPaused(!isPaused)} className="gap-1.5">
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? 'Retomar' : 'Pausar'}
          </Button>
        </div>
      </div>

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
          <Input placeholder="Filtrar por placa ou colaborador..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
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
          {isPaused && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white px-4 py-1.5 rounded-full text-xs font-semibold z-[1000] flex items-center gap-2">
              <Pause className="h-3 w-3" /> Feed pausado
            </div>
          )}
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
              {!isPaused && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />}
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
                    onClick={() => setSelectedVehicle(a.vehicleId)}
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
    </div>
  );
}
