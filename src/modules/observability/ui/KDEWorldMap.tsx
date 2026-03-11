/**
 * KDEWorldMap — Multi-scale KDE heatmap using native Leaflet circle markers.
 * Uses multiple concentric circles per point at different scales to create
 * a smooth density visualization that works at all zoom levels.
 */
import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveSession } from '@/domains/user-presence';

interface Props {
  sessions: ActiveSession[];
}

// KDE scale layers: each point gets rendered as multiple concentric circles
const KDE_LAYERS = [
  { radiusMeters: 80000, color: 'rgba(20,40,180,0.08)', weight: 0 },
  { radiusMeters: 50000, color: 'rgba(0,150,220,0.12)', weight: 0 },
  { radiusMeters: 30000, color: 'rgba(50,200,100,0.18)', weight: 0 },
  { radiusMeters: 15000, color: 'rgba(220,200,30,0.25)', weight: 0 },
  { radiusMeters: 6000,  color: 'rgba(240,120,20,0.35)', weight: 0 },
  { radiusMeters: 2000,  color: 'rgba(220,40,30,0.50)', weight: 0 },
  { radiusMeters: 600,   color: 'rgba(255,60,40,0.70)', weight: 0 },
];

export default function KDEWorldMap({ sessions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const kdeLayerRef = useRef<L.LayerGroup | null>(null);
  const pointLayerRef = useRef<L.LayerGroup | null>(null);

  const geoPoints = useMemo(
    () =>
      sessions
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({
          lat: s.latitude!,
          lng: s.longitude!,
          city: s.city,
          country: s.country,
          browser: s.browser,
          status: s.status,
          userId: s.user_id,
        })),
    [sessions],
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-15, -50],
      zoom: 4,
      minZoom: 2,
      maxZoom: 16,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render KDE + points when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous layers
    if (kdeLayerRef.current) {
      kdeLayerRef.current.clearLayers();
      map.removeLayer(kdeLayerRef.current);
    }
    if (pointLayerRef.current) {
      pointLayerRef.current.clearLayers();
      map.removeLayer(pointLayerRef.current);
    }

    kdeLayerRef.current = L.layerGroup();
    pointLayerRef.current = L.layerGroup();

    if (geoPoints.length === 0) {
      kdeLayerRef.current.addTo(map);
      pointLayerRef.current.addTo(map);
      return;
    }

    // Draw KDE layers (largest radius first for correct visual stacking)
    for (const layer of KDE_LAYERS) {
      for (const p of geoPoints) {
        L.circle([p.lat, p.lng], {
          radius: layer.radiusMeters,
          fillColor: layer.color,
          fillOpacity: 1,
          color: 'transparent',
          weight: layer.weight,
          interactive: false,
        }).addTo(kdeLayerRef.current!);
      }
    }

    // Draw session point markers on top
    for (const p of geoPoints) {
      const isOnline = p.status === 'online';
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        fillColor: isOnline ? '#10b981' : '#f59e0b',
        fillOpacity: 0.95,
        color: '#ffffff',
        weight: 2,
        opacity: 0.8,
      });

      const tooltipContent = [
        `<div style="font-size:11px;line-height:1.4">`,
        `<strong>${p.city || 'Local desconhecido'}${p.country ? ', ' + p.country : ''}</strong>`,
        `<br/><span style="opacity:0.7">Coords:</span> ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`,
        `<br/><span style="opacity:0.7">Status:</span> <span style="color:${isOnline ? '#10b981' : '#f59e0b'}">${isOnline ? '● Online' : '● Idle'}</span>`,
        p.browser ? `<br/><span style="opacity:0.7">Browser:</span> ${p.browser}` : '',
        `</div>`,
      ].join('');

      marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -8] });
      marker.addTo(pointLayerRef.current!);
    }

    kdeLayerRef.current.addTo(map);
    pointLayerRef.current.addTo(map);

    // Fit bounds
    const bounds = L.latLngBounds(geoPoints.map(p => [p.lat, p.lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 10 });
  }, [geoPoints]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[450px] rounded-lg border border-border"
      />

      {geoPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg pointer-events-none">
          <p className="text-sm text-muted-foreground">Sem dados geográficos disponíveis</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg px-3.5 py-3 border border-border shadow-lg">
        <div className="text-[10px] font-semibold text-foreground mb-2 tracking-wide uppercase">
          Densidade de Sessões
        </div>
        <div
          className="h-3 w-40 rounded-full mb-2 border border-border/40"
          style={{
            background:
              'linear-gradient(to right, rgba(20,40,180,0.4), rgba(0,150,220,0.5), rgba(50,200,100,0.6), rgba(220,200,30,0.7), rgba(240,120,20,0.8), rgba(220,40,30,0.95))',
          }}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground w-40">
          <span>Baixa</span>
          <span>Média</span>
          <span>Alta</span>
          <span>Crítica</span>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/50" /> Online
          </span>
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white/50" /> Idle
          </span>
        </div>
      </div>

      {/* Stats */}
      {geoPoints.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-md px-3 py-1.5 border border-border text-xs text-muted-foreground pointer-events-none">
          <span className="font-bold text-foreground">{geoPoints.length}</span> sessões geolocalizadas
        </div>
      )}
    </div>
  );
}
