/// <reference types="google.maps" />
/**
 * ZoneMapPicker — Interactive Google Maps picker for zone points with radius visualization.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useGoogleMapsKey } from './useGoogleMapsKey';
import { loadGoogleMaps } from './loadGoogleMaps';

interface ZoneMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onLocationChange: (lat: number, lng: number) => void;
  tenantId: string | null;
  className?: string;
}

export function ZoneMapPicker({ latitude, longitude, radiusMeters, onLocationChange, tenantId, className = '' }: ZoneMapPickerProps) {
  const { key, loading: keyLoading } = useGoogleMapsKey(tenantId);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!key) return;
    loadGoogleMaps(key).then(() => setReady(true)).catch(() => {});
  }, [key]);

  const updateCircle = useCallback((lat: number, lng: number, radius: number) => {
    if (circleRef.current) {
      circleRef.current.setCenter({ lat, lng });
      circleRef.current.setRadius(radius);
      circleRef.current.setVisible(true);
    }
  }, []);

  const placeMarker = useCallback((map: google.maps.Map, lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng });
    } else {
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        draggable: true,
        title: 'Zona de velocidade',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 8,
        },
      });
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          onLocationChange(pos.lat(), pos.lng());
          updateCircle(pos.lat(), pos.lng(), radiusMeters);
        }
      });
      markerRef.current = marker;
    }
    updateCircle(lat, lng, radiusMeters);
  }, [onLocationChange, radiusMeters, updateCircle]);

  // Init map
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const center = latitude && longitude ? { lat: latitude, lng: longitude } : { lat: -23.5505, lng: -46.6333 };

    const map = new google.maps.Map(containerRef.current, {
      center,
      zoom: latitude ? 14 : 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const circle = new google.maps.Circle({
      map,
      center,
      radius: radiusMeters,
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      strokeColor: '#3b82f6',
      strokeWeight: 2,
      strokeOpacity: 0.6,
      clickable: false,
      visible: !!(latitude && longitude),
    });
    circleRef.current = circle;

    if (latitude && longitude) {
      placeMarker(map, latitude, longitude);
    }

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      onLocationChange(lat, lng);
      placeMarker(map, lat, lng);
    });

    mapRef.current = map;

    return () => {
      markerRef.current = null;
      circleRef.current = null;
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Sync radius changes
  useEffect(() => {
    if (circleRef.current && latitude && longitude) {
      circleRef.current.setRadius(radiusMeters);
    }
  }, [radiusMeters, latitude, longitude]);

  if (keyLoading || (!ready && key)) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 250 }}>
        <span className="text-xs text-muted-foreground">Carregando mapa...</span>
      </div>
    );
  }

  if (!key) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 250 }}>
        <span className="text-xs text-muted-foreground">Google Maps API Key não configurada</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Clique no mapa para marcar o ponto central da zona. Arraste o marcador para ajustar.</p>
      <div ref={containerRef} className={`rounded-lg overflow-hidden border border-border ${className}`} style={{ height: 300 }} />
    </div>
  );
}
