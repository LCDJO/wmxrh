/**
 * LiveUserMapRenderer — World map showing login locations with:
 *  - Marker clusters by city
 *  - Kernel density heatmap toggle
 *  - Realtime updates via presence engine
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Flame, RefreshCw, Users } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchActiveSessions,
  usePresenceRealtime,
} from '@/domains/user-presence';
import type { ActiveSession } from '@/domains/user-presence';

// Fix default marker icons for leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GeoPoint {
  lat: number;
  lng: number;
  count: number;
  city: string;
  country: string;
  sessions: ActiveSession[];
}

export default function LiveUserMapRenderer() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchActiveSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePresenceRealtime(load);

  // Cluster sessions by city
  const clusters: GeoPoint[] = (() => {
    const map = new Map<string, GeoPoint>();
    for (const s of sessions) {
      if (s.latitude == null || s.longitude == null) continue;
      const key = `${s.city ?? 'unknown'}|${s.country ?? 'unknown'}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.sessions.push(s);
      } else {
        map.set(key, {
          lat: s.latitude,
          lng: s.longitude,
          count: 1,
          city: s.city ?? 'Desconhecido',
          country: s.country ?? '—',
          sessions: [s],
        });
      }
    }
    return Array.from(map.values());
  })();

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [-15.78, -47.93],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers/heatmap
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear previous layers
    if (layerRef.current) {
      layerRef.current.clearLayers();
      map.removeLayer(layerRef.current);
    }
    // Remove heatmap canvas
    if (heatCanvasRef.current) {
      heatCanvasRef.current.remove();
      heatCanvasRef.current = null;
    }

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    if (clusters.length === 0) return;

    if (heatmapOn) {
      // Canvas-based kernel density heatmap
      renderHeatmap(map, clusters);
    } else {
      // Clustered circle markers
      for (const pt of clusters) {
        const radius = Math.min(6 + Math.sqrt(pt.count) * 4, 30);
        const color = pt.count >= 10 ? '#ef4444' : pt.count >= 3 ? '#f59e0b' : '#22c55e';

        const marker = L.circleMarker([pt.lat, pt.lng], {
          radius,
          fillColor: color,
          fillOpacity: 0.7,
          color: 'rgba(255,255,255,0.4)',
          weight: 1,
        });

        marker.bindPopup(`
          <div style="font-family:system-ui;font-size:12px;">
            <strong>${pt.city}, ${pt.country}</strong><br/>
            <span>${pt.count} sessão${pt.count > 1 ? 'ões' : ''} ativa${pt.count > 1 ? 's' : ''}</span><br/>
            <span style="color:#888">${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</span>
          </div>
        `);

        marker.addTo(group);
      }

      // Fit bounds
      if (clusters.length > 0) {
        const bounds = L.latLngBounds(clusters.map(c => [c.lat, c.lng] as L.LatLngTuple));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
      }
    }
  }, [clusters, heatmapOn]);

  // Kernel density heatmap renderer
  function renderHeatmap(map: L.Map, points: GeoPoint[]) {
    const size = map.getSize();
    const canvas = document.createElement('canvas');
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    canvas.style.opacity = '0.6';

    const pane = map.getPane('overlayPane');
    if (pane) pane.appendChild(canvas);
    heatCanvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw kernel density
    const kernelRadius = 40;
    for (const pt of points) {
      const pixel = map.latLngToContainerPoint([pt.lat, pt.lng]);
      const intensity = Math.min(pt.count / 5, 1);
      const gradient = ctx.createRadialGradient(
        pixel.x, pixel.y, 0,
        pixel.x, pixel.y, kernelRadius
      );
      gradient.addColorStop(0, `rgba(239, 68, 68, ${0.4 + intensity * 0.5})`);
      gradient.addColorStop(0.4, `rgba(249, 115, 22, ${0.2 + intensity * 0.3})`);
      gradient.addColorStop(0.7, `rgba(234, 179, 8, ${0.1 + intensity * 0.15})`);
      gradient.addColorStop(1, 'rgba(234, 179, 8, 0)');

      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, kernelRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Re-render on map move
    const onMove = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const pt of points) {
        const pixel = map.latLngToContainerPoint([pt.lat, pt.lng]);
        const intensity = Math.min(pt.count / 5, 1);
        const gradient = ctx.createRadialGradient(
          pixel.x, pixel.y, 0,
          pixel.x, pixel.y, kernelRadius
        );
        gradient.addColorStop(0, `rgba(239, 68, 68, ${0.4 + intensity * 0.5})`);
        gradient.addColorStop(0.4, `rgba(249, 115, 22, ${0.2 + intensity * 0.3})`);
        gradient.addColorStop(0.7, `rgba(234, 179, 8, ${0.1 + intensity * 0.15})`);
        gradient.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, kernelRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    };
    map.on('moveend zoomend', onMove);

    // Fit bounds
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(c => [c.lat, c.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }
  }

  const geoSessions = sessions.filter(s => s.latitude != null && s.longitude != null);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Mapa de Logins em Tempo Real
          <Badge variant="secondary" className="text-[10px]">
            <Users className="h-3 w-3 mr-1" /> {geoSessions.length} com localização
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="heatmap-toggle"
              checked={heatmapOn}
              onCheckedChange={setHeatmapOn}
            />
            <Label htmlFor="heatmap-toggle" className="text-xs flex items-center gap-1 cursor-pointer">
              <Flame className="h-3.5 w-3.5 text-orange-500" /> Heatmap
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={mapRef}
          className="w-full rounded-b-lg"
          style={{ height: 480 }}
        />
      </CardContent>
    </Card>
  );
}
