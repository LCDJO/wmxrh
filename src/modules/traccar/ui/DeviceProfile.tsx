/**
 * DeviceProfile — Drill-down view for a specific vehicle/device.
 * Redesigned with grouped sections and clear visual hierarchy.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, Car, MapPin, Gauge, Clock, AlertTriangle, Shield, TrendingUp, Cpu, Navigation } from 'lucide-react';
import type { TraccarVehicle } from '@/hooks/fleet/useTraccarFleet';
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

const STATUS_COLORS: Record<string, string> = {
  moving: 'bg-emerald-500',
  idle: 'bg-amber-500',
  stopped: 'bg-muted-foreground',
  speeding: 'bg-destructive',
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

  const computedStatus = vehicle.computedStatus || 'stopped';

  return (
    <Card className="w-full">
      {/* ── Header ── */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{vehicle.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={vehicle.status === 'online' ? 'default' : 'secondary'}
                  className={`text-[10px] px-2 py-0 h-5 ${
                    vehicle.status === 'online'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      : ''
                  }`}
                >
                  {vehicle.status === 'online' ? '● Online' : '● Offline'}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[computedStatus]}`} />
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[computedStatus] || computedStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Telemetria em Tempo Real ── */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Navigation className="h-3 w-3" /> Telemetria
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Gauge className="h-3 w-3" />
                <span className="text-[11px] uppercase tracking-wider">Velocidade</span>
              </div>
              <p className="text-lg font-bold tabular-nums">{vehicle.speed ?? 0} <span className="text-xs font-normal text-muted-foreground">km/h</span></p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="text-[11px] uppercase tracking-wider">Posição</span>
              </div>
              <p className="text-xs font-mono tabular-nums">{vehicle.lat?.toFixed(5)}, {vehicle.lng?.toFixed(5)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="text-[11px] uppercase tracking-wider">Última Att.</span>
              </div>
              <p className="text-xs">{vehicle.lastUpdate ? new Date(vehicle.lastUpdate).toLocaleString('pt-BR') : '—'}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-[11px] uppercase tracking-wider">Ignição</span>
              </div>
              <Badge variant={vehicle.ignition ? 'default' : 'secondary'} className="text-xs mt-0.5">
                {vehicle.ignition ? '⚡ Ligada' : '○ Desligada'}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Comportamento (30 dias) ── */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> Comportamento (30 dias)
          </h4>
          {behaviorSummary ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{behaviorSummary.totalEvents}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">Eventos</p>
              </div>
              <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-destructive">
                  {(behaviorSummary.bySeverity.critical || 0) + (behaviorSummary.bySeverity.high || 0)}
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">Crítico + Alto</p>
              </div>
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center">
              <p className="text-xs text-muted-foreground animate-pulse">Carregando dados...</p>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Compliance ── */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="h-3 w-3" /> Compliance
          </h4>
          {complianceSummary ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xl font-bold tabular-nums">{complianceSummary.totalIncidents}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Incidentes</p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-amber-600">{complianceSummary.pendingReview}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Pendentes</p>
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-center">
                <TrendingUp className="h-5 w-5 text-primary mx-auto" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Score</p>
              </div>
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center">
              <p className="text-xs text-muted-foreground animate-pulse">Carregando dados...</p>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Metadados do Dispositivo ── */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Cpu className="h-3 w-3" /> Dispositivo
          </h4>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">ID Único</span>
              <span className="font-mono text-foreground">{vehicle.uniqueId}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Categoria</span>
              <span className="text-foreground">{vehicle.category || '—'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Modelo</span>
              <span className="text-foreground">{vehicle.model || '—'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
