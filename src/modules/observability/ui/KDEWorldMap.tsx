/**
 * KDEWorldMap — Multi-scale canvas KDE heatmap on Leaflet.
 * 
 * Renders 3 layers at different bandwidths (macro/meso/micro) that
 * blend together, giving a natural density feel at any zoom level.
 */
import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveSession } from '@/domains/user-presence';

interface Props {
  sessions: ActiveSession[];
}

// ═══════════════════════════════════════
// PALETTE
// ═══════════════════════════════════════

let paletteCache: Uint8ClampedArray | null = null;

function getPalette(): Uint8ClampedArray {
  if (paletteCache) return paletteCache;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.04, 'rgba(10,20,120,0.15)');
  grad.addColorStop(0.10, 'rgba(20,50,180,0.30)');
  grad.addColorStop(0.20, 'rgba(30,100,220,0.45)');
  grad.addColorStop(0.35, 'rgba(0,190,220,0.55)');
  grad.addColorStop(0.50, 'rgba(50,210,80,0.62)');
  grad.addColorStop(0.65, 'rgba(180,220,30,0.72)');
  grad.addColorStop(0.78, 'rgba(250,180,20,0.80)');
  grad.addColorStop(0.90, 'rgba(240,80,20,0.88)');
  grad.addColorStop(1.0, 'rgba(220,30,30,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  paletteCache = ctx.getImageData(0, 0, 256, 1).data;
  return paletteCache;
}

// ═══════════════════════════════════════
// MULTI-SCALE HEATMAP RENDERING
// ═══════════════════════════════════════

interface ScaleLayer {
  radiusFactor: number;  // multiplier on base radius
  intensity: number;     // alpha multiplier (0-1)
}

const SCALE_LAYERS: ScaleLayer[] = [
  { radiusFactor: 3.0, intensity: 0.20 },  // macro — broad glow
  { radiusFactor: 1.5, intensity: 0.35 },  // meso — mid range
  { radiusFactor: 0.6, intensity: 0.55 },  // micro — tight core
];

function renderHeatCanvas(
  canvas: HTMLCanvasElement,
  map: L.Map,
  points: { lat: number; lng: number }[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = map.getSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size.x * dpr;
  canvas.height = size.y * dpr;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (points.length === 0) return;

  const zoom = map.getZoom();
  // Base radius scales exponentially with zoom
  const baseRadius = Math.max(15, 14 * Math.pow(1.55, zoom - 2));

  // Convert all points to pixel coords once
  const pixelPoints = points.map(p => {
    const px = map.latLngToContainerPoint([p.lat, p.lng]);
    return { x: px.x * dpr, y: px.y * dpr };
  });

  // Draw each scale layer additively
  ctx.globalCompositeOperation = 'lighter';

  for (const layer of SCALE_LAYERS) {
    const r = baseRadius * layer.radiusFactor * dpr;
    const alpha = layer.intensity;

    for (const px of pixelPoints) {
      const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, r);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.15, `rgba(255,255,255,${alpha * 0.7})`);
      grad.addColorStop(0.35, `rgba(255,255,255,${alpha * 0.4})`);
      grad.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.12})`);
      grad.addColorStop(0.85, `rgba(255,255,255,${alpha * 0.03})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px.x, px.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Colorize
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const palette = getPalette();

  for (let i = 0; i < data.length; i += 4) {
    const val = data[i];
    if (val < 2) {
      data[i + 3] = 0;
      continue;
    }
    const idx = Math.min(255, val) * 4;
    data[i] = palette[idx];
    data[i + 1] = palette[idx + 1];
    data[i + 2] = palette[idx + 2];
    data[i + 3] = palette[idx + 3];
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.putImageData(imageData, 0, 0);
}

// ═══════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════

export default function KDEWorldMap({ sessions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const geoPointsRef = useRef<{ lat: number; lng: number }[]>([]);

  const geoPoints = useMemo(
    () =>
      sessions
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({ lat: s.latitude!, lng: s.longitude! })),
    [sessions],
  );

  geoPointsRef.current = geoPoints;

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-10, -50],
      zoom: 3,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
    }).addTo(map);

    // Canvas overlay — appended to map container (NOT a pane) so it doesn't get transformed
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:399;';
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;
    mapRef.current = map;

    const redraw = () => {
      if (canvasRef.current && mapRef.current) {
        renderHeatCanvas(canvasRef.current, mapRef.current, geoPointsRef.current);
      }
    };

    map.on('moveend', redraw);
    map.on('zoomend', redraw);
    map.on('resize', redraw);

    return () => {
      map.remove();
      mapRef.current = null;
      canvasRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update when sessions change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !canvasRef.current) return;

    renderHeatCanvas(canvasRef.current, map, geoPoints);

    // Point markers
    if (markersRef.current) markersRef.current.clearLayers();
    markersRef.current = L.layerGroup().addTo(map);

    for (const p of geoPoints) {
      L.circleMarker([p.lat, p.lng], {
        radius: 4,
        fillColor: '#ffffff',
        fillOpacity: 0.9,
        color: 'rgba(255,255,255,0.4)',
        weight: 1.5,
      })
        .bindTooltip(
          `<div style="font-size:11px"><strong>${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}</strong></div>`,
          { direction: 'top' },
        )
        .addTo(markersRef.current!);
    }

    if (geoPoints.length > 0) {
      const bounds = L.latLngBounds(geoPoints.map(p => [p.lat, p.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
    }
  }, [geoPoints]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[450px] rounded-lg border border-border overflow-hidden"
      />

      {geoPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg pointer-events-none">
          <p className="text-sm text-muted-foreground">Sem dados geográficos disponíveis</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[500] bg-background/90 backdrop-blur-sm rounded-lg px-3.5 py-3 border border-border shadow-lg">
        <div className="text-[10px] font-semibold text-foreground mb-2 tracking-wide uppercase">
          Densidade de Sessões
        </div>
        <div
          className="h-3 w-40 rounded-full mb-2 border border-border/40"
          style={{
            background:
              'linear-gradient(to right, rgba(10,20,120,0.3), rgba(30,100,220,0.5), rgba(0,190,220,0.6), rgba(50,210,80,0.65), rgba(250,180,20,0.8), rgba(220,30,30,0.95))',
          }}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground w-40">
          <span>Baixa</span>
          <span>Média</span>
          <span>Alta</span>
          <span>Crítica</span>
        </div>
      </div>

      {/* Stats */}
      {geoPoints.length > 0 && (
        <div className="absolute top-4 left-4 z-[500] bg-background/90 backdrop-blur-sm rounded-md px-3 py-1.5 border border-border text-xs text-muted-foreground pointer-events-none">
          <span className="font-bold text-foreground">{geoPoints.length}</span> sessões geolocalizadas
        </div>
      )}
    </div>
  );
}
