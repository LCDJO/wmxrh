/**
 * KDEWorldMap — Multi-scale KDE heatmap using native Leaflet circles.
 * 
 * 12 concentric layers per point from continental (500km) to street-level (50m),
 * enabling smooth density visualization across all zoom levels (2→18).
 * Layers are dynamically shown/hidden based on zoom for performance.
 */
import { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveSession } from '@/domains/user-presence';

interface Props {
  sessions: ActiveSession[];
}

// Multi-scale KDE layers: from macro (continental) to micro (street)
// Each layer is visible at specific zoom ranges for performance
interface KDELayerDef {
  radiusMeters: number;
  color: string;
  minZoom: number;
  maxZoom: number;
  label: string;
}

const KDE_LAYERS: KDELayerDef[] = [
  // === MACRO — visible zoomed out (continents/countries) ===
  { radiusMeters: 500000, color: 'rgba(15,25,120,0.04)',  minZoom: 2,  maxZoom: 5,  label: 'continental' },
  { radiusMeters: 250000, color: 'rgba(20,50,180,0.06)',  minZoom: 2,  maxZoom: 6,  label: 'regional' },
  { radiusMeters: 120000, color: 'rgba(25,80,200,0.08)',  minZoom: 3,  maxZoom: 7,  label: 'state' },
  // === MESO — mid-range zoom (states/cities) ===
  { radiusMeters: 60000,  color: 'rgba(0,150,220,0.10)',  minZoom: 4,  maxZoom: 9,  label: 'metro' },
  { radiusMeters: 30000,  color: 'rgba(30,190,180,0.14)', minZoom: 5,  maxZoom: 10, label: 'city' },
  { radiusMeters: 15000,  color: 'rgba(50,200,100,0.18)', minZoom: 6,  maxZoom: 12, label: 'district' },
  // === MICRO — close zoom (neighborhoods/streets) ===
  { radiusMeters: 6000,   color: 'rgba(150,210,30,0.22)', minZoom: 7,  maxZoom: 14, label: 'neighborhood' },
  { radiusMeters: 2500,   color: 'rgba(220,200,30,0.28)', minZoom: 8,  maxZoom: 15, label: 'block' },
  { radiusMeters: 1000,   color: 'rgba(240,150,20,0.35)', minZoom: 9,  maxZoom: 16, label: 'street' },
  { radiusMeters: 400,    color: 'rgba(240,80,20,0.42)',  minZoom: 10, maxZoom: 17, label: 'building' },
  { radiusMeters: 150,    color: 'rgba(220,40,30,0.55)',  minZoom: 12, maxZoom: 18, label: 'precise' },
  { radiusMeters: 50,     color: 'rgba(200,20,20,0.70)',  minZoom: 14, maxZoom: 18, label: 'exact' },
];

export default function KDEWorldMap({ sessions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const kdeGroupsRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const pointLayerRef = useRef<L.LayerGroup | null>(null);
  const [currentZoom, setCurrentZoom] = useState(4);

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
          os: s.os,
          status: s.status,
          userId: s.user_id,
          lastActivity: s.last_activity,
        })),
    [sessions],
  );

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-15, -50],
      zoom: 4,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    map.on('zoomend', () => setCurrentZoom(map.getZoom()));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update KDE layer visibility on zoom change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const [label, group] of kdeGroupsRef.current) {
      const def = KDE_LAYERS.find(l => l.label === label);
      if (!def) continue;
      if (currentZoom >= def.minZoom && currentZoom <= def.maxZoom) {
        if (!map.hasLayer(group)) map.addLayer(group);
      } else {
        if (map.hasLayer(group)) map.removeLayer(group);
      }
    }
  }, [currentZoom]);

  // Render KDE layers + points when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear all existing KDE groups
    for (const [, group] of kdeGroupsRef.current) {
      group.clearLayers();
      if (map.hasLayer(group)) map.removeLayer(group);
    }
    kdeGroupsRef.current.clear();

    if (pointLayerRef.current) {
      pointLayerRef.current.clearLayers();
      map.removeLayer(pointLayerRef.current);
    }
    pointLayerRef.current = L.layerGroup();

    if (geoPoints.length === 0) {
      pointLayerRef.current.addTo(map);
      return;
    }

    // Create a layer group per KDE scale
    const zoom = map.getZoom();
    for (const layerDef of KDE_LAYERS) {
      const group = L.layerGroup();

      for (const p of geoPoints) {
        L.circle([p.lat, p.lng], {
          radius: layerDef.radiusMeters,
          fillColor: layerDef.color,
          fillOpacity: 1,
          color: 'transparent',
          weight: 0,
          interactive: false,
        }).addTo(group);
      }

      kdeGroupsRef.current.set(layerDef.label, group);

      // Only add to map if within zoom range
      if (zoom >= layerDef.minZoom && zoom <= layerDef.maxZoom) {
        group.addTo(map);
      }
    }

    // Session point markers
    for (const p of geoPoints) {
      const isOnline = p.status === 'online';

      // Outer glow
      L.circleMarker([p.lat, p.lng], {
        radius: 10,
        fillColor: isOnline ? '#10b981' : '#f59e0b',
        fillOpacity: 0.15,
        color: 'transparent',
        weight: 0,
        interactive: false,
      }).addTo(pointLayerRef.current!);

      // Inner dot
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        fillColor: isOnline ? '#10b981' : '#f59e0b',
        fillOpacity: 0.95,
        color: '#ffffff',
        weight: 2,
        opacity: 0.8,
      });

      const ago = p.lastActivity
        ? formatTimeAgo(new Date(p.lastActivity))
        : '';

      const tooltipContent = [
        `<div style="font-size:11px;line-height:1.5;min-width:140px">`,
        `<strong>${p.city || 'Local desconhecido'}${p.country ? ', ' + p.country : ''}</strong>`,
        `<br/><span style="opacity:0.6">📍</span> ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`,
        `<br/><span style="color:${isOnline ? '#10b981' : '#f59e0b'}">●</span> ${isOnline ? 'Online' : 'Idle'}${ago ? ' · ' + ago : ''}`,
        p.browser ? `<br/><span style="opacity:0.6">🌐</span> ${p.browser}${p.os ? ' / ' + p.os : ''}` : '',
        `</div>`,
      ].join('');

      marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -8] });
      marker.addTo(pointLayerRef.current!);
    }

    pointLayerRef.current.addTo(map);

    // Fit bounds
    const bounds = L.latLngBounds(geoPoints.map(p => [p.lat, p.lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12 });
  }, [geoPoints]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[480px] rounded-lg border border-border"
      />

      {geoPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg pointer-events-none">
          <p className="text-sm text-muted-foreground">Sem dados geográficos disponíveis</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg px-3.5 py-3 border border-border shadow-lg">
        <div className="text-[10px] font-semibold text-foreground mb-2 tracking-wide uppercase">
          Densidade KDE
        </div>
        <div
          className="h-3 w-44 rounded-full mb-2 border border-border/40"
          style={{
            background:
              'linear-gradient(to right, rgba(15,25,120,0.3), rgba(25,80,200,0.4), rgba(0,150,220,0.5), rgba(50,200,100,0.6), rgba(220,200,30,0.7), rgba(240,80,20,0.8), rgba(200,20,20,0.95))',
          }}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground w-44">
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
        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[8px] text-muted-foreground/60">
          Zoom: {currentZoom.toFixed(1)} · Camadas: {KDE_LAYERS.filter(l => currentZoom >= l.minZoom && currentZoom <= l.maxZoom).length}/12
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

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
