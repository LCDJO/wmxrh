/**
 * KDEWorldMap — World map with Kernel Density Estimation overlay
 * for visualizing login/session geographic distribution.
 */
import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveSession } from '@/domains/user-presence';

interface Props {
  sessions: ActiveSession[];
}

// Gaussian kernel function
function gaussianKernel(distance: number, bandwidth: number): number {
  const u = distance / bandwidth;
  return Math.exp(-0.5 * u * u) / (bandwidth * Math.sqrt(2 * Math.PI));
}

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface KDEPoint {
  lat: number;
  lng: number;
  density: number;
}

function computeKDE(points: { lat: number; lng: number }[], gridRes = 1.5, bandwidth = 300): KDEPoint[] {
  if (points.length === 0) return [];

  // Bounding box
  const minLat = Math.max(-85, Math.min(...points.map(p => p.lat)) - 10);
  const maxLat = Math.min(85, Math.max(...points.map(p => p.lat)) + 10);
  const minLng = Math.max(-180, Math.min(...points.map(p => p.lng)) - 10);
  const maxLng = Math.min(180, Math.max(...points.map(p => p.lng)) + 10);

  const grid: KDEPoint[] = [];
  let maxDensity = 0;

  for (let lat = minLat; lat <= maxLat; lat += gridRes) {
    for (let lng = minLng; lng <= maxLng; lng += gridRes) {
      let density = 0;
      for (const p of points) {
        const dist = haversine(lat, lng, p.lat, p.lng);
        density += gaussianKernel(dist, bandwidth);
      }
      if (density > 0.0001) {
        grid.push({ lat, lng, density });
        if (density > maxDensity) maxDensity = density;
      }
    }
  }

  // Normalize
  if (maxDensity > 0) {
    for (const g of grid) {
      g.density = g.density / maxDensity;
    }
  }

  return grid;
}

function densityToColor(d: number): string {
  // Cool-to-hot gradient: blue → cyan → green → yellow → red
  if (d < 0.2) return `hsla(220, 80%, 60%, ${0.15 + d * 2})`;
  if (d < 0.4) return `hsla(190, 75%, 50%, ${0.25 + d})`;
  if (d < 0.6) return `hsla(120, 65%, 45%, ${0.35 + d * 0.8})`;
  if (d < 0.8) return `hsla(45, 90%, 50%, ${0.5 + d * 0.4})`;
  return `hsla(0, 85%, 50%, ${0.6 + d * 0.3})`;
}

export default function KDEWorldMap({ sessions }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const geoPoints = useMemo(
    () =>
      sessions
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({ lat: s.latitude!, lng: s.longitude! })),
    [sessions]
  );

  const kdeGrid = useMemo(() => computeKDE(geoPoints), [geoPoints]);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center: [0, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
    }).addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Render KDE
  useEffect(() => {
    if (!mapInstance.current) return;

    if (layerRef.current) layerRef.current.clearLayers();
    layerRef.current = L.layerGroup().addTo(mapInstance.current);

    // Draw KDE cells
    for (const point of kdeGrid) {
      const radius = Math.max(8, point.density * 25);
      const color = densityToColor(point.density);

      L.circleMarker([point.lat, point.lng], {
        radius,
        fillColor: color,
        fillOpacity: 0.6,
        color: 'transparent',
        weight: 0,
      }).addTo(layerRef.current);
    }

    // Draw actual session points on top
    for (const p of geoPoints) {
      L.circleMarker([p.lat, p.lng], {
        radius: 3,
        fillColor: '#ffffff',
        fillOpacity: 0.9,
        color: '#ffffff',
        weight: 1,
        opacity: 0.4,
      }).addTo(layerRef.current!);
    }

    // Fit bounds if we have points
    if (geoPoints.length > 0) {
      const bounds = L.latLngBounds(geoPoints.map(p => [p.lat, p.lng] as L.LatLngTuple));
      mapInstance.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
    }
  }, [kdeGrid, geoPoints]);

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[420px] rounded-lg border border-border" />
      {geoPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
          <p className="text-sm text-muted-foreground">Sem dados geográficos disponíveis</p>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-background/80 backdrop-blur rounded-md px-3 py-2 border border-border text-[10px] space-y-1">
        <div className="font-medium text-foreground mb-1">Densidade (KDE)</div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: 'hsla(220,80%,60%,0.5)' }} />
          <span className="text-muted-foreground">Baixa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: 'hsla(120,65%,45%,0.7)' }} />
          <span className="text-muted-foreground">Média</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: 'hsla(45,90%,50%,0.8)' }} />
          <span className="text-muted-foreground">Alta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: 'hsla(0,85%,50%,0.9)' }} />
          <span className="text-muted-foreground">Crítica</span>
        </div>
      </div>
    </div>
  );
}
