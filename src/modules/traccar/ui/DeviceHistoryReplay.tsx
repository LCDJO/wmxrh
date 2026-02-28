/**
 * DeviceHistoryReplay — Fetches route history from Traccar API and renders replay.
 * Allows selecting a device and date range to view historical routes.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, History, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { RouteReplayPanel } from './btie/RouteReplayPanel';
import type { TraccarVehicle } from '@/hooks/useTraccarFleet';

interface DeviceHistoryReplayProps {
  tenantId: string;
  vehicles: TraccarVehicle[];
  /** Pre-select a specific device */
  initialDeviceId?: number;
  onClose?: () => void;
}

type PeriodPreset = '1h' | '3h' | '6h' | '12h' | 'today' | 'yesterday' | '7d';

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  '1h': 'Última 1h',
  '3h': 'Últimas 3h',
  '6h': 'Últimas 6h',
  '12h': 'Últimas 12h',
  'today': 'Hoje',
  'yesterday': 'Ontem',
  '7d': 'Últimos 7 dias',
};

function getDateRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  switch (preset) {
    case '1h': return { from: new Date(now.getTime() - 1 * 3600000).toISOString(), to };
    case '3h': return { from: new Date(now.getTime() - 3 * 3600000).toISOString(), to };
    case '6h': return { from: new Date(now.getTime() - 6 * 3600000).toISOString(), to };
    case '12h': return { from: new Date(now.getTime() - 12 * 3600000).toISOString(), to };
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to };
    }
    case 'yesterday': {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case '7d': return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to };
  }
}

const KNOTS_TO_KMH = 1.852;

export function DeviceHistoryReplay({ tenantId, vehicles, initialDeviceId, onClose }: DeviceHistoryReplayProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(initialDeviceId ? String(initialDeviceId) : '');
  const [period, setPeriod] = useState<PeriodPreset>('today');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<any[] | null>(null);
  const [routeStats, setRouteStats] = useState<{ points: number; maxSpeed: number; avgSpeed: number; distance: string } | null>(null);

  const fetchRoute = useCallback(async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    setError(null);
    setPositions(null);
    setRouteStats(null);

    try {
      const { from, to } = getDateRange(period);

      const { data, error: fnError } = await supabase.functions.invoke('traccar-proxy', {
        body: {
          action: 'reports-route',
          tenantId,
          deviceId: selectedDeviceId,
          from,
          to,
        },
      });

      if (fnError) throw new Error(fnError.message);

      const resp = data as { success: boolean; data: any[]; error?: string };
      if (!resp.success) throw new Error(resp.error || 'Erro ao buscar rota');

      const routeData = resp.data;
      if (!Array.isArray(routeData) || routeData.length < 2) {
        setError('Nenhuma posição encontrada neste período. O dispositivo pode não ter se movimentado.');
        return;
      }

      // Transform Traccar positions to our replay format
      const mapped = routeData.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed, // already in knots from Traccar
        event_timestamp: p.deviceTime || p.fixTime,
        course: p.course,
        attributes: p.attributes || {},
      }));

      // Calculate stats
      const speeds = mapped.map((p: any) => p.speed * KNOTS_TO_KMH);
      const maxSpeed = Math.round(Math.max(...speeds));
      const avgSpeed = Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length);

      // Rough distance calc (Haversine sum)
      let totalDist = 0;
      for (let i = 1; i < mapped.length; i++) {
        totalDist += haversine(
          mapped[i - 1].latitude, mapped[i - 1].longitude,
          mapped[i].latitude, mapped[i].longitude,
        );
      }

      setRouteStats({
        points: mapped.length,
        maxSpeed,
        avgSpeed,
        distance: totalDist.toFixed(1),
      });
      setPositions(mapped);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar histórico');
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, period, tenantId]);

  const selectedDevice = vehicles.find(v => String(v.id) === selectedDeviceId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Rota — Replay
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Device selector */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Dispositivo</label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name} {v.uniqueId && `(${v.uniqueId})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period selector */}
            <div className="min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Período</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fetch button */}
            <Button
              onClick={fetchRoute}
              disabled={!selectedDeviceId || loading}
              className="gap-1.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Buscar Rota
            </Button>
          </div>

          {/* Stats summary */}
          {routeStats && (
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="text-xs gap-1">
                <MapPin className="h-3 w-3" /> {routeStats.distance} km
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                {routeStats.points} pontos
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                Méd: {routeStats.avgSpeed} km/h
              </Badge>
              <Badge variant={routeStats.maxSpeed > 80 ? 'destructive' : 'outline'} className="text-xs gap-1">
                Máx: {routeStats.maxSpeed} km/h
              </Badge>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Replay panel */}
      {positions && positions.length >= 2 && (
        <RouteReplayPanel
          positions={positions}
          deviceName={selectedDevice?.name}
          speedLimitKmh={80}
          onClose={() => setPositions(null)}
        />
      )}
    </div>
  );
}

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
