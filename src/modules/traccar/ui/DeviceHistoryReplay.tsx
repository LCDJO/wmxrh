/**
 * DeviceHistoryReplay — Fetches route history from Traccar API and renders replay.
 * Redesigned with cleaner layout and grouped controls.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Loader2, MapPin, AlertTriangle, Route, Gauge, Clock, X } from 'lucide-react';
import { RouteReplayPanel } from './btie/RouteReplayPanel';
import type { TraccarVehicle } from '@/hooks/fleet/useTraccarFleet';

interface DeviceHistoryReplayProps {
  tenantId: string;
  vehicles: TraccarVehicle[];
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

      const mapped = routeData.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed,
        event_timestamp: p.deviceTime || p.fixTime,
        course: p.course,
        attributes: p.attributes || {},
      }));

      const speeds = mapped.map((p: any) => p.speed * KNOTS_TO_KMH);
      const maxSpeed = Math.round(Math.max(...speeds));
      const avgSpeed = Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length);

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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Replay de Rota
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Controls Group ── */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Dispositivo</label>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="h-9">
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

              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Período</label>
                <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={fetchRoute}
              disabled={!selectedDeviceId || loading}
              className="w-full gap-2 h-9"
              size="sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
              {loading ? 'Buscando...' : 'Buscar Rota'}
            </Button>
          </div>

          {/* ── Stats Grid ── */}
          {routeStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm font-bold tabular-nums">{routeStats.distance} km</p>
                <p className="text-[10px] text-muted-foreground">Distância</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <Clock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm font-bold tabular-nums">{routeStats.points}</p>
                <p className="text-[10px] text-muted-foreground">Pontos</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm font-bold tabular-nums">{routeStats.avgSpeed} km/h</p>
                <p className="text-[10px] text-muted-foreground">Média</p>
              </div>
              <div className={`rounded-lg p-2.5 text-center ${routeStats.maxSpeed > 80 ? 'bg-destructive/5 border border-destructive/10' : 'bg-muted/30'}`}>
                <Gauge className={`h-3.5 w-3.5 mx-auto mb-1 ${routeStats.maxSpeed > 80 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <p className={`text-sm font-bold tabular-nums ${routeStats.maxSpeed > 80 ? 'text-destructive' : ''}`}>{routeStats.maxSpeed} km/h</p>
                <p className="text-[10px] text-muted-foreground">Máxima</p>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Replay Panel ── */}
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

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
