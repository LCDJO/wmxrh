/**
 * KDEWorldMap — Canvas-based Kernel Density Estimation heatmap
 * rendered as a smooth Leaflet overlay on a dark world map.
 */
import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveSession } from '@/domains/user-presence';

interface Props {
  sessions: ActiveSession[];
}

// ═══════════════════════════════════════
// CANVAS HEATMAP RENDERING
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
  grad.addColorStop(0.06, 'rgba(20,40,180,0.3)');
  grad.addColorStop(0.18, 'rgba(30,100,220,0.5)');
  grad.addColorStop(0.32, 'rgba(0,200,220,0.6)');
  grad.addColorStop(0.48, 'rgba(50,210,80,0.68)');
  grad.addColorStop(0.62, 'rgba(180,220,30,0.76)');
  grad.addColorStop(0.76, 'rgba(250,180,20,0.84)');
  grad.addColorStop(0.9, 'rgba(240,80,20,0.9)');
  grad.addColorStop(1.0, 'rgba(220,30,30,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  paletteCache = ctx.getImageData(0, 0, 256, 1).data;
  return paletteCache;
}

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
  canvas.style.width = size.x + 'px';
  canvas.style.height = size.y + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size.x, size.y);

  if (points.length === 0) return;

  const zoom = map.getZoom();
  const radius = Math.max(25, 18 * Math.pow(1.5, zoom - 2));

  // 1) Draw grayscale intensity (additive)
  ctx.globalCompositeOperation = 'lighter';

  for (const p of points) {
    const px = map.latLngToContainerPoint([p.lat, p.lng]);
    const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, radius);
    grad.addColorStop(0, 'rgba(255,255,255,0.65)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.04)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px.x, px.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2) Colorize pixels
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform for pixel manipulation
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

  // Keep ref in sync for event handlers
  geoPointsRef.current = geoPoints;

  // Init map (once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-10, -50],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
    }).addTo(map);

    // Canvas overlay — below Leaflet overlays pane
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:250;';
    map.getPane('overlayPane')!.appendChild(canvas);
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

  // Update heatmap + markers when sessions change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !canvasRef.current) return;

    // Redraw heatmap
    renderHeatCanvas(canvasRef.current, map, geoPoints);

    // Point markers
    if (markersRef.current) markersRef.current.clearLayers();
    markersRef.current = L.layerGroup().addTo(map);

    for (const p of geoPoints) {
      L.circleMarker([p.lat, p.lng], {
        radius: 3.5,
        fillColor: '#ffffff',
        fillOpacity: 0.85,
        color: 'rgba(255,255,255,0.3)',
        weight: 1,
      })
        .bindTooltip(`${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`, { direction: 'top' })
        .addTo(markersRef.current!);
    }

    if (geoPoints.length > 0) {
      const bounds = L.latLngBounds(geoPoints.map(p => [p.lat, p.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
    }
  }, [geoPoints]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[450px] rounded-lg border border-border overflow-hidden" />

      {geoPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg pointer-events-none">
          <p className="text-sm text-muted-foreground">Sem dados geográficos disponíveis</p>
        </div>
      )}

      {/* Legend — outside map container, positioned over it */}
      <div className="absolute bottom-4 right-4 z-[500] bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-border shadow-lg pointer-events-auto">
        <div className="text-[10px] font-semibold text-foreground mb-2 tracking-wide uppercase">
          Densidade de Sessões
        </div>
        <div
          className="h-3 w-36 rounded-full mb-1.5 border border-border/50"
          style={{
            background:
              'linear-gradient(to right, rgba(20,40,180,0.6), rgba(0,200,220,0.7), rgba(50,210,80,0.75), rgba(250,180,20,0.85), rgba(220,30,30,0.95))',
          }}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground w-36">
          <span>Baixa</span>
          <span>Média</span>
          <span>Alta</span>
        </div>
      </div>

      {/* Stats badge */}
      {geoPoints.length > 0 && (
        <div className="absolute top-4 left-4 z-[500] bg-background/90 backdrop-blur-sm rounded-md px-3 py-1.5 border border-border text-xs text-muted-foreground pointer-events-none">
          <span className="font-bold text-foreground">{geoPoints.length}</span> sessões geolocalizadas
        </div>
      )}
    </div>
  );
}
