/**
 * ViolationsHeatmapTab — Renders a Leaflet heatmap of behavior events.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flame, AlertTriangle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
  type: string;
  severity: string;
}

export function ViolationsHeatmapTab({ tenantId }: { tenantId: string }) {
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState('30');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - parseInt(daysBack));

    // Fetch violations with coordinates
    const { data: violations } = await supabase
      .from('fleet_speed_violations')
      .select('latitude, longitude, excess_kmh, severity, source_type, detected_at')
      .eq('tenant_id', tenantId)
      .gte('detected_at', from.toISOString())
      .not('latitude', 'is', null)
      .limit(500);

    // Fetch behavior events with coordinates
    const { data: behaviorEvents } = await supabase
      .from('fleet_behavior_events')
      .select('details, severity, event_type, event_timestamp')
      .eq('tenant_id', tenantId)
      .gte('event_timestamp', from.toISOString())
      .limit(500);

    const heatPoints: HeatPoint[] = [];

    // Process violations
    for (const v of violations || []) {
      if (v.latitude && v.longitude) {
        const sevWeight = v.severity === 'critical' ? 15 : v.severity === 'high' ? 8 : v.severity === 'medium' ? 4 : 2;
        heatPoints.push({
          lat: v.latitude,
          lng: v.longitude,
          intensity: sevWeight,
          type: v.source_type || 'speed',
          severity: v.severity || 'medium',
        });
      }
    }

    // Process behavior events that have coordinates
    for (const evt of behaviorEvents || []) {
      const details = evt.details as any;
      if (details?.latitude && details?.longitude) {
        const sevWeight = evt.severity === 'critical' ? 15 : evt.severity === 'high' ? 8 : evt.severity === 'medium' ? 4 : 2;
        heatPoints.push({
          lat: details.latitude,
          lng: details.longitude,
          intensity: sevWeight,
          type: evt.event_type,
          severity: evt.severity,
        });
      }
    }

    setPoints(heatPoints);
    setLoading(false);
  }, [tenantId, daysBack]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Render map
  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
    }

    // Clear existing markers
    if (markersRef.current) markersRef.current.clearLayers();
    markersRef.current = L.layerGroup().addTo(mapInstance.current);

    const severityColors: Record<string, string> = {
      low: '#22c55e',
      medium: '#eab308',
      high: '#f97316',
      critical: '#ef4444',
    };

    const latLngs: L.LatLng[] = [];

    for (const p of points) {
      const color = severityColors[p.severity] || severityColors.medium;
      const radius = Math.min(15, 4 + p.intensity);

      const marker = L.circleMarker(L.latLng(p.lat, p.lng), {
        radius,
        fillColor: color,
        fillOpacity: 0.5,
        color: color,
        weight: 1,
        opacity: 0.7,
      });

      marker.bindTooltip(`${p.type} • ${p.severity}`, { direction: 'top' });
      markersRef.current!.addLayer(marker);
      latLngs.push(L.latLng(p.lat, p.lng));
    }

    if (latLngs.length > 0) {
      mapInstance.current.fitBounds(L.latLngBounds(latLngs), { padding: [30, 30] });
    }

    return () => {
      // Cleanup on unmount
    };
  }, [points]);

  // Cleanup map on component unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const stats = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const p of points) {
      bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
      byType[p.type] = (byType[p.type] || 0) + 1;
    }
    return { bySeverity, byType, total: points.length };
  }, [points]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4" /> Heatmap de Infrações
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={daysBack} onValueChange={setDaysBack}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats summary */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            {stats.total} pontos
          </Badge>
          {stats.bySeverity.critical && (
            <Badge variant="destructive" className="text-xs">
              {stats.bySeverity.critical} críticos
            </Badge>
          )}
          {stats.bySeverity.high && (
            <Badge variant="destructive" className="text-xs">
              {stats.bySeverity.high} graves
            </Badge>
          )}
          {stats.bySeverity.medium && (
            <Badge className="text-xs">
              {stats.bySeverity.medium} médios
            </Badge>
          )}
          {stats.bySeverity.low && (
            <Badge variant="secondary" className="text-xs">
              {stats.bySeverity.low} leves
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Carregando heatmap...
          </div>
        ) : points.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma infração com coordenadas no período.</p>
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-[450px] rounded-lg border" />
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Leve</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500" /> Média</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500" /> Grave</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> Crítica</span>
        </div>
      </CardContent>
    </Card>
  );
}
