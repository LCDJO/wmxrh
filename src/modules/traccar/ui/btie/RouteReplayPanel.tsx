/**
 * RouteReplayPanel — Shows a trip's route on a map with playback controls.
 * Uses Leaflet for rendering the polyline + animated marker.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, Gauge, MapPin, Clock } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Position {
  latitude: number;
  longitude: number;
  speed: number;
  event_timestamp: string;
}

interface RouteReplayProps {
  positions: Position[];
  deviceName?: string;
  speedLimitKmh?: number;
  onClose?: () => void;
}

const KNOTS_TO_KMH = 1.852;

export function RouteReplayPanel({ positions, deviceName, speedLimitKmh = 80, onClose }: RouteReplayProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const polyRef = useRef<L.Polyline | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sorted = useMemo(() =>
    [...positions].sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()),
    [positions]
  );

  const coords = useMemo(() => sorted.map(p => [p.latitude, p.longitude] as [number, number]), [sorted]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || coords.length === 0) return;

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const bounds = L.latLngBounds(coords.map(c => L.latLng(c[0], c[1])));
    map.fitBounds(bounds, { padding: [30, 30] });

    // Full route polyline (faded)
    polyRef.current = L.polyline(coords, { color: 'hsl(var(--muted-foreground))', weight: 2, opacity: 0.3 }).addTo(map);

    // Traveled trail
    trailRef.current = L.polyline([], { color: 'hsl(var(--primary))', weight: 3, opacity: 0.8 }).addTo(map);

    // Current position marker
    markerRef.current = L.circleMarker(L.latLng(coords[0][0], coords[0][1]), {
      radius: 8,
      fillColor: 'hsl(var(--primary))',
      fillOpacity: 1,
      color: '#fff',
      weight: 2,
    }).addTo(map);

    // Start / end markers
    L.circleMarker(L.latLng(coords[0][0], coords[0][1]), {
      radius: 6, fillColor: '#22c55e', fillOpacity: 1, color: '#fff', weight: 2,
    }).addTo(map).bindTooltip('Início');

    L.circleMarker(L.latLng(coords[coords.length - 1][0], coords[coords.length - 1][1]), {
      radius: 6, fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2,
    }).addTo(map).bindTooltip('Fim');

    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, [coords]);

  // Update position
  useEffect(() => {
    if (!markerRef.current || !trailRef.current || coords.length === 0) return;
    const pos = coords[idx];
    markerRef.current.setLatLng(L.latLng(pos[0], pos[1]));

    const speedKmh = sorted[idx].speed * KNOTS_TO_KMH;
    const color = speedKmh > speedLimitKmh ? '#ef4444' : 'hsl(var(--primary))';
    markerRef.current.setStyle({ fillColor: color });

    trailRef.current.setLatLngs(coords.slice(0, idx + 1));
  }, [idx, coords, sorted, speedLimitKmh]);

  // Playback timer
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setIdx(prev => {
          if (prev >= sorted.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 150);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, sorted.length]);

  const current = sorted[idx];
  const speedKmh = current ? Math.round(current.speed * KNOTS_TO_KMH) : 0;
  const isOver = speedKmh > speedLimitKmh;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Replay de Rota {deviceName && `— ${deviceName}`}
        </CardTitle>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={mapRef} className="w-full h-[350px] rounded-lg border" />

        {/* Speed indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className={`text-lg font-bold ${isOver ? 'text-destructive' : ''}`}>
              {speedKmh} km/h
            </span>
            {isOver && <Badge variant="destructive" className="text-[10px]">EXCESSO</Badge>}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {current && new Date(current.event_timestamp).toLocaleTimeString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {idx + 1} / {sorted.length} pontos
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIdx(0)}>
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPlaying(!playing)}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIdx(sorted.length - 1)}>
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
          <div className="flex-1">
            <Slider
              value={[idx]}
              min={0}
              max={Math.max(0, sorted.length - 1)}
              step={1}
              onValueChange={([v]) => { setPlaying(false); setIdx(v); }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
