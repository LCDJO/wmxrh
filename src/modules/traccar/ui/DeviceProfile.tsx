/**
 * DeviceProfile — Drill-down view for a specific vehicle/device.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, Car, MapPin, Gauge, Clock, AlertTriangle, Shield, TrendingUp } from 'lucide-react';
import type { TraccarVehicle } from '@/hooks/useTraccarFleet';
import { getBehaviorSummary, type BehaviorSummary } from '../services/behavior-engine.service';
import { getComplianceSummary, type ComplianceSummary } from '../services/compliance.service';

interface DeviceProfileProps {
  vehicle: TraccarVehicle;
  tenantId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  moving: 'Em Movimento',
  idle: 'Parado (Ligado)',
  stopped: 'Parado',
  speeding: 'Excesso de Velocidade',
};

export function DeviceProfile({ vehicle, tenantId, onClose }: DeviceProfileProps) {
  const [behaviorSummary, setBehaviorSummary] = useState<BehaviorSummary | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [beh, comp] = await Promise.all([
        getBehaviorSummary(tenantId, { deviceId: String(vehicle.id), days: 30 }),
        getComplianceSummary(tenantId, 30),
      ]);
      setBehaviorSummary(beh);
      setComplianceSummary(comp);
    } catch {}
  }, [tenantId, vehicle.id]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="h-4 w-4" /> {vehicle.name}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2 mt-1">
          <Badge variant={vehicle.status === 'online' ? 'default' : 'secondary'} className="text-xs">
            {vehicle.status === 'online' ? '🟢 Online' : '🔴 Offline'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {STATUS_LABELS[vehicle.computedStatus || 'stopped'] || vehicle.computedStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Telemetry */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Velocidade:</span>
            <span className="font-medium">{vehicle.speed ?? 0} km/h</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Lat/Lng:</span>
            <span className="font-mono text-xs">{vehicle.lat?.toFixed(4)}, {vehicle.lng?.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Atualizado:</span>
            <span className="text-xs">{vehicle.lastUpdate ? new Date(vehicle.lastUpdate).toLocaleString('pt-BR') : '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ignição:</span>
            <Badge variant={vehicle.ignition ? 'default' : 'secondary'} className="text-xs">
              {vehicle.ignition ? 'Ligada' : 'Desligada'}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Behavior Summary */}
        <div>
          <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Comportamento (30 dias)
          </h4>
          {behaviorSummary ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted/40 rounded p-2">
                <div className="text-lg font-bold">{behaviorSummary.totalEvents}</div>
                <div className="text-xs text-muted-foreground">Total Eventos</div>
              </div>
              <div className="bg-muted/40 rounded p-2">
                <div className="text-lg font-bold text-destructive">
                  {(behaviorSummary.bySeverity.critical || 0) + (behaviorSummary.bySeverity.high || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Crítico + Alto</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          )}
        </div>

        <Separator />

        {/* Compliance Summary */}
        <div>
          <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
            <Shield className="h-3.5 w-3.5" /> Compliance
          </h4>
          {complianceSummary ? (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-muted/40 rounded p-2 text-center">
                <div className="text-lg font-bold">{complianceSummary.totalIncidents}</div>
                <div className="text-xs text-muted-foreground">Incidentes</div>
              </div>
              <div className="bg-muted/40 rounded p-2 text-center">
                <div className="text-lg font-bold text-amber-500">{complianceSummary.pendingReview}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
              <div className="bg-muted/40 rounded p-2 text-center">
                <div className="text-lg font-bold text-primary">
                  <TrendingUp className="h-4 w-4 inline" />
                </div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          )}
        </div>

        {/* Device metadata */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <div>ID Único: <span className="font-mono">{vehicle.uniqueId}</span></div>
          <div>Categoria: {vehicle.category || '—'}</div>
          <div>Modelo: {vehicle.model || '—'}</div>
        </div>
      </CardContent>
    </Card>
  );
}
