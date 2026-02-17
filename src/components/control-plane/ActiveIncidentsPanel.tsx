/**
 * ActiveIncidentsPanel — Shows active Self-Healing incidents + circuit breakers.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Flame, ShieldAlert, Activity,
  Clock, Play, CheckCircle2, Zap,
} from 'lucide-react';
import type { PlatformStateSnapshot, ControlAction } from '@/domains/control-plane/types';

interface ActiveIncidentsPanelProps {
  state: PlatformStateSnapshot | null;
  onAction: (action: ControlAction) => void;
}

export function ActiveIncidentsPanel({ state, onAction }: ActiveIncidentsPanelProps) {
  if (!state) return null;

  const sh = state.self_healing;
  const hasIssues = sh.active_incidents > 0 || sh.open_circuit_breakers > 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-destructive" /> Incidentes & Circuitos
        </CardTitle>
        {hasIssues && (
          <Badge variant="destructive" className="text-[10px]">
            {sh.active_incidents + sh.open_circuit_breakers} ativo(s)
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {!sh.enabled ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            Self-Healing desabilitado
          </div>
        ) : !hasIssues ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            Nenhum incidente ativo — plataforma estável
          </div>
        ) : (
          <ScrollArea className="h-[220px]">
            <div className="space-y-3">
              {/* Incidents summary */}
              {sh.active_incidents > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-semibold text-destructive">{sh.active_incidents} incidente(s) ativo(s)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Zap className="h-3 w-3" /> Auto-recovered: {sh.auto_recovered_total}</div>
                    <div className="flex items-center gap-1"><Activity className="h-3 w-3" /> Escalados: {sh.escalated_total}</div>
                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo médio: {sh.avg_recovery_time_ms > 0 ? `${(sh.avg_recovery_time_ms / 1000).toFixed(1)}s` : '—'}</div>
                    <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Resolvidos: {sh.resolved_incidents_total}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs mt-1"
                    onClick={() => onAction({ type: 'force_health_check' })}
                  >
                    <Play className="h-3 w-3 mr-1" /> Forçar Health Check
                  </Button>
                </div>
              )}

              {/* Circuit breakers */}
              {sh.open_circuit_breakers > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-600">{sh.open_circuit_breakers} circuit breaker(s) aberto(s)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Módulos com circuit breaker aberto estão temporariamente isolados para proteger a plataforma.
                  </p>
                </div>
              )}

              {/* Uptime */}
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
                <span>Uptime estimado</span>
                <span className="font-mono font-semibold text-foreground">{sh.uptime_pct.toFixed(2)}%</span>
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
