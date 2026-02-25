/**
 * ZoneMapPicker — Interactive Mapbox map for picking a point and visualizing radius.
 * Click on the map to set lat/lng, drag the marker to adjust, circle shows coverage.
 */
import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from './useMapboxToken';
import * as turf from '@turf/turf';

interface ZoneMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onLocationChange: (lat: number, lng: number) => void;
  className?: string;
}

export function ZoneMapPicker({ latitude, longitude, radiusMeters, onLocationChange, className = '' }: ZoneMapPickerProps) {
  const { token, loading: tokenLoading } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const updateCircle = useCallback((map: mapboxgl.Map, lng: number, lat: number, radius: number) => {
    const circle = turf.circle([lng, lat], radius / 1000, { steps: 64, units: 'kilometers' });
    const src = map.getSource('zone-radius') as mapboxgl.GeoJSONSource;
    if (src) {
      src.setData(circle);
    }
  }, []);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const center: [number, number] = longitude && latitude ? [longitude, latitude] : [-46.6333, -23.5505];

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: latitude ? 14 : 10,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Add radius circle source & layer
      map.addSource('zone-radius', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'zone-radius-fill',
        type: 'fill',
        source: 'zone-radius',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.15 },
      });
      map.addLayer({
        id: 'zone-radius-border',
        type: 'line',
        source: 'zone-radius',
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] },
      });

      // If we already have coords, show marker + circle
      if (latitude && longitude) {
        addMarker(map, longitude, latitude);
        updateCircle(map, longitude, latitude, radiusMeters);
      }
    });

    // Click to place marker
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      onLocationChange(lat, lng);
      addMarker(map, lng, lat);
      updateCircle(map, lng, lat, radiusMeters);
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Update circle when radius changes
  useEffect(() => {
    if (!mapRef.current || !latitude || !longitude) return;
    updateCircle(mapRef.current, longitude, latitude, radiusMeters);
  }, [radiusMeters, latitude, longitude, updateCircle]);

  function addMarker(map: mapboxgl.Map, lng: number, lat: number) {
    markerRef.current?.remove();
    const marker = new mapboxgl.Marker({ color: '#3b82f6', draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      onLocationChange(pos.lat, pos.lng);
      updateCircle(map, pos.lng, pos.lat, radiusMeters);
    });
    markerRef.current = marker;
  }

  if (tokenLoading) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 250 }}>
        <span className="text-xs text-muted-foreground">Carregando mapa...</span>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`} style={{ minHeight: 250 }}>
        <span className="text-xs text-muted-foreground">Token do Mapbox não configurado</span>
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
