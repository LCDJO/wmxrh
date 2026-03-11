/**
 * KDEWorldMap — 15-layer smoothed Kernel Density Estimation heatmap.
 * 
 * Uses L.circle with 15 graduated layers from 600km (continental) to 30m 
 * (pinpoint). Each layer uses carefully tuned opacity and smooth color 
 * transitions following a proper Gaussian-inspired falloff curve.
 * Layers are zoom-adaptive for performance.
 */
import { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveSession } from '@/domains/user-presence';

interface Props {
  sessions: ActiveSession[];
}

interface KDELayerDef {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  minZ: number;
  maxZ: number;
}

// 15 smoothly graduated layers with Gaussian-like opacity falloff
// Colors transition: deep indigo → blue → cyan → teal → green → lime → yellow → orange → red
const KDE_LAYERS: KDELayerDef[] = [
  { radius: 600000, fill: 'rgba(30,20,100,0.025)',  stroke: 'rgba(30,20,100,0.01)',   strokeWidth: 1, minZ: 2,  maxZ: 5  },
  { radius: 400000, fill: 'rgba(30,40,160,0.035)',  stroke: 'rgba(30,40,160,0.015)',  strokeWidth: 1, minZ: 2,  maxZ: 6  },
  { radius: 250000, fill: 'rgba(25,70,200,0.045)',  stroke: 'rgba(25,70,200,0.02)',   strokeWidth: 1, minZ: 2,  maxZ: 7  },
  { radius: 160000, fill: 'rgba(15,110,210,0.055)', stroke: 'rgba(15,110,210,0.025)', strokeWidth: 0, minZ: 3,  maxZ: 8  },
  { radius: 100000, fill: 'rgba(0,160,200,0.065)',  stroke: 'rgba(0,160,200,0.03)',   strokeWidth: 0, minZ: 3,  maxZ: 9  },
  { radius: 60000,  fill: 'rgba(0,190,170,0.08)',   stroke: 'transparent',            strokeWidth: 0, minZ: 4,  maxZ: 10 },
  { radius: 35000,  fill: 'rgba(30,200,120,0.10)',  stroke: 'transparent',            strokeWidth: 0, minZ: 5,  maxZ: 11 },
  { radius: 20000,  fill: 'rgba(80,210,60,0.13)',   stroke: 'transparent',            strokeWidth: 0, minZ: 5,  maxZ: 12 },
  { radius: 12000,  fill: 'rgba(160,215,30,0.16)',  stroke: 'transparent',            strokeWidth: 0, minZ: 6,  maxZ: 13 },
  { radius: 7000,   fill: 'rgba(210,200,20,0.20)',  stroke: 'transparent',            strokeWidth: 0, minZ: 7,  maxZ: 14 },
  { radius: 3500,   fill: 'rgba(240,165,15,0.26)',  stroke: 'transparent',            strokeWidth: 0, minZ: 8,  maxZ: 15 },
  { radius: 1500,   fill: 'rgba(245,110,15,0.34)',  stroke: 'transparent',            strokeWidth: 0, minZ: 9,  maxZ: 16 },
  { radius: 500,    fill: 'rgba(235,60,20,0.44)',   stroke: 'transparent',            strokeWidth: 0, minZ: 10, maxZ: 17 },
  { radius: 150,    fill: 'rgba(210,30,25,0.58)',   stroke: 'transparent',            strokeWidth: 0, minZ: 12, maxZ: 18 },
  { radius: 30,     fill: 'rgba(180,15,20,0.72)',   stroke: 'transparent',            strokeWidth: 0, minZ: 14, maxZ: 18 },
];

export default function KDEWorldMap({ sessions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const kdeGroupsRef = useRef<Map<number, L.LayerGroup>>(new Map());
  const pointLayerRef = useRef<L.LayerGroup | null>(null);
  const [zoom, setZoom] = useState(4);

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
          ip: s.ip_address,
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
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;
    map.on('zoomend', () => setZoom(map.getZoom()));
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Toggle layers by zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [idx, group] of kdeGroupsRef.current) {
      const def = KDE_LAYERS[idx];
      const visible = zoom >= def.minZ && zoom <= def.maxZ;
      if (visible && !map.hasLayer(group)) map.addLayer(group);
      if (!visible && map.hasLayer(group)) map.removeLayer(group);
    }
  }, [zoom]);

  // Build KDE + markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Cleanup
    for (const [, g] of kdeGroupsRef.current) { g.clearLayers(); map.removeLayer(g); }
    kdeGroupsRef.current.clear();
    if (pointLayerRef.current) { pointLayerRef.current.clearLayers(); map.removeLayer(pointLayerRef.current); }
    pointLayerRef.current = L.layerGroup();

    if (geoPoints.length === 0) { pointLayerRef.current.addTo(map); return; }

    const curZoom = map.getZoom();
    const showKDE = geoPoints.length >= 10;

    // Create 15 KDE layer groups (only if 10+ sessions)
    if (showKDE) {
      KDE_LAYERS.forEach((def, idx) => {
        const group = L.layerGroup();
        for (const p of geoPoints) {
          L.circle([p.lat, p.lng], {
            radius: def.radius,
            fillColor: def.fill,
            fillOpacity: 1,
            color: def.stroke,
            weight: def.strokeWidth,
            interactive: false,
          }).addTo(group);
        }
        kdeGroupsRef.current.set(idx, group);
        if (curZoom >= def.minZ && curZoom <= def.maxZ) group.addTo(map);
      });
    }

    // Session markers with glow
    for (const p of geoPoints) {
      const on = p.status === 'online';
      const color = on ? '#10b981' : '#f59e0b';

      // Outer pulse glow
      L.circleMarker([p.lat, p.lng], {
        radius: 12, fillColor: color, fillOpacity: 0.12,
        color: color, weight: 1, opacity: 0.15, interactive: false,
      }).addTo(pointLayerRef.current!);

      // Inner dot
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 5, fillColor: color, fillOpacity: 0.95,
        color: '#fff', weight: 2, opacity: 0.85,
      });

      const ago = timeAgo(new Date(p.lastActivity));
      m.bindTooltip(
        `<div style="font-size:11px;line-height:1.5;min-width:150px">` +
        `<strong>${p.city || '—'}${p.country ? ', ' + p.country : ''}</strong>` +
        `<br/>📍 ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` +
        (p.ip ? `<br/>🌐 IP: <code style="font-size:10px">${p.ip}</code>` : '') +
        `<br/><span style="color:${color}">●</span> ${on ? 'Online' : 'Idle'} · ${ago}` +
        (p.browser ? `<br/>💻 ${p.browser}${p.os ? ' / ' + p.os : ''}` : '') +
        `</div>`,
        { direction: 'top', offset: [0, -10] },
      );
      m.addTo(pointLayerRef.current!);
    }

    pointLayerRef.current.addTo(map);

    const bounds = L.latLngBounds(geoPoints.map(p => [p.lat, p.lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12 });
  }, [geoPoints]);

  const activeLayers = KDE_LAYERS.filter(l => zoom >= l.minZ && zoom <= l.maxZ).length;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[500px] rounded-lg border border-border" />

      {geoPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg pointer-events-none">
          <p className="text-sm text-muted-foreground">Sem dados geográficos disponíveis</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-background/92 backdrop-blur-md rounded-xl px-4 py-3.5 border border-border shadow-xl">
        <div className="text-[10px] font-bold text-foreground mb-2.5 tracking-wider uppercase">
          Kernel Density Estimation
        </div>
        {/* Gradient bar */}
        <div className="relative h-4 w-48 rounded-lg mb-2 overflow-hidden border border-border/30">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right,
                rgba(30,20,100,0.3),
                rgba(25,70,200,0.4),
                rgba(0,160,200,0.5),
                rgba(0,190,170,0.55),
                rgba(80,210,60,0.6),
                rgba(160,215,30,0.65),
                rgba(210,200,20,0.7),
                rgba(240,165,15,0.78),
                rgba(245,110,15,0.85),
                rgba(235,60,20,0.9),
                rgba(180,15,20,0.95)
              )`,
            }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-muted-foreground w-48 mb-3">
          <span>Dispersa</span>
          <span>Baixa</span>
          <span>Média</span>
          <span>Alta</span>
          <span>Densa</span>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/40">
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/40 shadow-sm shadow-emerald-500/30" />
            Online
          </span>
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white/40 shadow-sm shadow-amber-500/30" />
            Idle
          </span>
        </div>

        {/* Zoom info */}
        <div className="mt-2 pt-2 border-t border-border/30 text-[8px] text-muted-foreground/70 flex justify-between">
          <span>Zoom {zoom.toFixed(1)}</span>
          <span>{activeLayers}/15 camadas</span>
        </div>
      </div>

      {/* Stats */}
      {geoPoints.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-background/92 backdrop-blur-md rounded-lg px-3.5 py-2 border border-border shadow-lg text-xs text-muted-foreground pointer-events-none">
          <span className="font-bold text-foreground text-sm">{geoPoints.length}</span>
          <span className="ml-1">sessões geolocalizadas</span>
        </div>
      )}
    </div>
  );
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
