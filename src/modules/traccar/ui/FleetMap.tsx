/**
 * FleetMap — Real-time fleet map using Mapbox GL.
 */
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from './useMapboxToken';
import type { TraccarVehicle } from '@/hooks/useTraccarFleet';

interface FleetMapProps {
  vehicles: TraccarVehicle[];
  onVehicleClick?: (vehicle: TraccarVehicle) => void;
  heatmapMode?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  moving: '#22c55e',
  idle: '#eab308',
  stopped: '#6b7280',
  speeding: '#ef4444',
};

export function FleetMap({ vehicles, onVehicleClick, heatmapMode = false, className = '' }: FleetMapProps) {
  const { token, loading: tokenLoading } = useMapboxToken();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-46.6333, -23.5505], // São Paulo default
      zoom: 10,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setMapReady(true);

      // Add heatmap source
      map.addSource('fleet-heatmap', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'fleet-heatmap-layer',
        type: 'heatmap',
        source: 'fleet-heatmap',
        layout: { visibility: heatmapMode ? 'visible' : 'none' },
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': 1.5,
          'heatmap-radius': 30,
          'heatmap-opacity': 0.7,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'hsl(210, 80%, 60%)',
            0.4, 'hsl(142, 71%, 45%)',
            0.6, 'hsl(48, 96%, 53%)',
            0.8, 'hsl(25, 95%, 53%)',
            1, 'hsl(0, 84%, 60%)',
          ],
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  // Toggle heatmap visibility
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    try {
      map.setLayoutProperty('fleet-heatmap-layer', 'visibility', heatmapMode ? 'visible' : 'none');
    } catch {}
  }, [heatmapMode, mapReady]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const validVehicles = vehicles.filter(v => v.lat && v.lng);

    // Update heatmap data
    const heatFeatures = validVehicles.map(v => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [v.lng!, v.lat!] },
      properties: { weight: v.speed && v.speed > 80 ? 3 : v.speed && v.speed > 50 ? 2 : 1 },
    }));

    const source = map.getSource('fleet-heatmap') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features: heatFeatures });
    }

    if (heatmapMode) return;

    // Add markers for each vehicle
    for (const v of validVehicles) {
      const color = STATUS_COLORS[v.computedStatus || 'stopped'];

      const el = document.createElement('div');
      el.className = 'fleet-marker';
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: ${color}; border: 2px solid white;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      `;
      el.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;
      el.style.transform = `rotate(${v.course || 0}deg)`;

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(`
        <div style="font-family: system-ui; font-size: 12px; min-width: 140px;">
          <strong>${v.name}</strong><br/>
          <span style="color: ${color}">● ${v.computedStatus}</span><br/>
          ${v.speed != null ? `Velocidade: ${v.speed} km/h<br/>` : ''}
          ${v.ignition != null ? `Ignição: ${v.ignition ? 'Ligada' : 'Desligada'}<br/>` : ''}
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el, rotation: 0 })
        .setLngLat([v.lng!, v.lat!])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => onVehicleClick?.(v));
      markersRef.current.push(marker);
    }

    // Fit bounds
    if (validVehicles.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      validVehicles.forEach(v => bounds.extend([v.lng!, v.lat!]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, [vehicles, mapReady, heatmapMode, onVehicleClick]);

  if (tokenLoading) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 400 }}>
        <div className="text-muted-foreground text-sm">Carregando mapa...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 400 }}>
        <div className="text-muted-foreground text-sm">Token do Mapbox não configurado</div>
      </div>
    );
  }

  return <div ref={mapContainer} className={`rounded-lg overflow-hidden ${className}`} style={{ minHeight: 400 }} />;
}
