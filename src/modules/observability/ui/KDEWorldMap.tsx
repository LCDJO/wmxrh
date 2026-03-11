/**
 * KDEWorldMap — Canvas-based Kernel Density Estimation heatmap
 * rendered as a smooth Leaflet overlay on a dark world map.
 */
import { useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveSession } from '@/domains/user-presence';

interface Props {
  sessions: ActiveSession[];
}

// ═══════════════════════════════════════
// CANVAS HEATMAP LAYER
// ═══════════════════════════════════════

/** Draw a smooth KDE heatmap onto a canvas using radial gradients per point. */
function renderHeatCanvas(
  canvas: HTMLCanvasElement,
  map: L.Map,
  points: { lat: number; lng: number }[],
  radius = 35,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = map.getSize();
  canvas.width = size.x;
  canvas.height = size.y;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (points.length === 0) return;

  // 1) Draw grayscale intensity layer (additive blending)
  ctx.globalCompositeOperation = 'lighter';

  for (const p of points) {
    const px = map.latLngToContainerPoint([p.lat, p.lng]);
    const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, radius);
    grad.addColorStop(0, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px.x, px.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2) Colorize: read pixels, map grayscale intensity → heatmap color
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const palette = buildPalette();

  for (let i = 0; i < data.length; i += 4) {
    const intensity = data[i]; // grayscale value 0-255
    if (intensity < 3) {
      data[i + 3] = 0; // transparent
      continue;
    }
    const idx = Math.min(255, intensity);
    data[i] = palette[idx * 4];
    data[i + 1] = palette[idx * 4 + 1];
    data[i + 2] = palette[idx * 4 + 2];
    data[i + 3] = palette[idx * 4 + 3];
  }

  ctx.putImageData(imageData, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

/** Build a 256-step RGBA palette: transparent → blue → cyan → green → yellow → red */
function buildPalette(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);

  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.05, 'rgba(20, 50, 180, 0.25)');
  grad.addColorStop(0.15, 'rgba(30, 100, 220, 0.45)');
  grad.addColorStop(0.3, 'rgba(0, 200, 220, 0.55)');
  grad.addColorStop(0.45, 'rgba(50, 210, 80, 0.65)');
  grad.addColorStop(0.6, 'rgba(180, 220, 30, 0.75)');
  grad.addColorStop(0.75, 'rgba(250, 180, 20, 0.82)');
  grad.addColorStop(0.88, 'rgba(240, 80, 20, 0.88)');
  grad.addColorStop(1.0, 'rgba(220, 30, 30, 0.95)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

// ═══════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════

export default function KDEWorldMap({ sessions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointMarkersRef = useRef<L.LayerGroup | null>(null);

  const geoPoints = useMemo(
    () =>
      sessions
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({ lat: s.latitude!, lng: s.longitude! })),
    [sessions],
  );

  const redraw = useCallback(() => {
    if (!mapInstance.current || !canvasRef.current) return;
    // Scale radius by zoom for consistent visual
    const zoom = mapInstance.current.getZoom();
    const radius = Math.max(20, 12 * Math.pow(1.6, zoom - 2));
    renderHeatCanvas(canvasRef.current, mapInstance.current, geoPoints, radius);
  }, [geoPoints]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapInstance.current) return;

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

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    mapInstance.current = map;

    map.on('moveend zoomend resize', () => redraw());

    return () => {
      map.remove();
      mapInstance.current = null;
      canvasRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render heatmap + point markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Redraw canvas heatmap
    redraw();

    // Point markers
    if (pointMarkersRef.current) pointMarkersRef.current.clearLayers();
    pointMarkersRef.current = L.layerGroup().addTo(map);

    for (const p of geoPoints) {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 3.5,
        fillColor: '#ffffff',
        fillOpacity: 0.85,
        color: 'rgba(255,255,255,0.3)',
        weight: 1,
      });
      marker.bindTooltip(`${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`, { direction: 'top', className: 'text-xs' });
      pointMarkersRef.current.addLayer(marker);
    }

    // Fit bounds
    if (geoPoints.length > 0) {
      const bounds = L.latLngBounds(geoPoints.map(p => [p.lat, p.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
    }
  }, [geoPoints, redraw]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[450px] rounded-lg border border-border overflow-hidden" />

      {geoPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
          <p className="text-sm text-muted-foreground">Sem dados geográficos disponíveis</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-background/85 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-border shadow-lg">
        <div className="text-[10px] font-semibold text-foreground mb-2 tracking-wide uppercase">Densidade</div>
        <div
          className="h-2.5 w-32 rounded-full mb-1.5"
          style={{
            background: 'linear-gradient(to right, rgba(20,50,180,0.5), rgba(0,200,220,0.6), rgba(50,210,80,0.7), rgba(250,180,20,0.8), rgba(220,30,30,0.95))',
          }}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground w-32">
          <span>Baixa</span>
          <span>Média</span>
          <span>Alta</span>
        </div>
      </div>

      {/* Stats badge */}
      {geoPoints.length > 0 && (
        <div className="absolute top-3 left-3 bg-background/85 backdrop-blur-sm rounded-md px-2.5 py-1.5 border border-border text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">{geoPoints.length}</span> sessões geolocalizadas
        </div>
      )}
    </div>
  );
}
