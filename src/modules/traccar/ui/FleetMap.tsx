/// <reference types="google.maps" />
/**
 * FleetMap — Real-time fleet map using Google Maps.
 */
import { useEffect, useRef, useState } from 'react';
import { useGoogleMapsKey } from './useGoogleMapsKey';
import { loadGoogleMaps } from './loadGoogleMaps';
import { useDefaultMapCenter } from './useDefaultMapCenter';
import type { TraccarVehicle } from '@/hooks/useTraccarFleet';

interface FleetMapProps {
  vehicles: TraccarVehicle[];
  onVehicleClick?: (vehicle: TraccarVehicle) => void;
  heatmapMode?: boolean;
  tenantId: string | null;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  moving: '#22c55e',
  idle: '#eab308',
  stopped: '#6b7280',
  speeding: '#ef4444',
};

export function FleetMap({ vehicles, onVehicleClick, heatmapMode = false, tenantId, className = '' }: FleetMapProps) {
  const { key, loading: keyLoading } = useGoogleMapsKey(tenantId);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [ready, setReady] = useState(false);
  const defaultCenter = useDefaultMapCenter(tenantId);

  // Load Google Maps script
  useEffect(() => {
    if (!key) return;
    loadGoogleMaps(key).then(() => setReady(true)).catch(() => {});
  }, [key]);

  // Init map
  useEffect(() => {
    if (!ready || !mapContainer.current || mapRef.current) return;

    const map = new google.maps.Map(mapContainer.current, {
      center: defaultCenter,
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
      ],
    });

    infoWindowRef.current = new google.maps.InfoWindow();
    mapRef.current = map;

    return () => {
      mapRef.current = null;
      infoWindowRef.current = null;
    };
  }, [ready]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (heatmapMode) return;

    const validVehicles = vehicles.filter(v => v.lat && v.lng);

    for (const v of validVehicles) {
      const color = STATUS_COLORS[v.computedStatus || 'stopped'];

      const marker = new google.maps.Marker({
        position: { lat: v.lat!, lng: v.lng! },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 10,
        },
        title: v.name,
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="font-family: system-ui; font-size: 12px; min-width: 140px;">
              <strong>${v.name}</strong><br/>
              <span style="color: ${color}">● ${v.computedStatus}</span><br/>
              ${v.speed != null ? `Velocidade: ${v.speed} km/h<br/>` : ''}
              ${v.ignition != null ? `Ignição: ${v.ignition ? 'Ligada' : 'Desligada'}<br/>` : ''}
            </div>
          `);
          infoWindowRef.current.open(map, marker);
        }
        onVehicleClick?.(v);
      });

      markersRef.current.push(marker);
    }

    // Fit bounds
    if (validVehicles.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      validVehicles.forEach(v => bounds.extend({ lat: v.lat!, lng: v.lng! }));
      map.fitBounds(bounds, 60);
    }
  }, [vehicles, ready, heatmapMode, onVehicleClick]);

  if (keyLoading || (!ready && key)) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 400 }}>
        <div className="text-muted-foreground text-sm">Carregando mapa...</div>
      </div>
    );
  }

  if (!key) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 400 }}>
        <div className="text-muted-foreground text-sm">Google Maps API Key não configurada</div>
      </div>
    );
  }

  return <div ref={mapContainer} className={`rounded-lg overflow-hidden ${className}`} style={{ minHeight: 400 }} />;
}
