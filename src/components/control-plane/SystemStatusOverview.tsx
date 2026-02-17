/**
 * SystemStatusOverview — Real-time platform health & key metrics widget.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity, Server, Cpu, Zap, AlertTriangle, RefreshCw,
  CheckCircle2, XCircle, Clock, Brain, Shield, Heart,
} from 'lucide-react';
import type { PlatformStateSnapshot } from '@/domains/control-plane/types';

function HealthIndicator({ health }: { health: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    healthy: { color: 'bg-emerald-500', icon: <CheckCircle2 className="h-5 w-5" />, label: 'Operacional' },
    degraded: { color: 'bg-amber-500', icon: <AlertTriangle className="h-5 w-5" />, label: 'Degradado' },
    critical: { color: 'bg-destructive', icon: <XCircle className="h-5 w-5" />, label: 'Crítico' },
    unknown: { color: 'bg-muted', icon: <Clock className="h-5 w-5" />, label: 'Desconhecido' },
  };
  const c = config[health] ?? config.unknown;
  return (
    <div className="flex items-center gap-3">
      <div className={`h-12 w-12 rounded-full ${c.color} flex items-center justify-center text-white shadow-lg`}>
        {c.icon}
      </div>
      <div>
        <div className="text-lg font-bold text-foreground">{c.label}</div>
        <div className="text-xs text-muted-foreground">Estado geral da plataforma</div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${alert ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}

interface SystemStatusOverviewProps {
  state: PlatformStateSnapshot | null;
  onRefresh: () => void;
}

export function SystemStatusOverview({ state, onRefresh }: SystemStatusOverviewProps) {
  if (!state) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          Carregando estado da plataforma...
        </CardContent>
      </Card>
    );
  }

  const uptimeStr = state.uptime_ms > 0
    ? `${Math.floor(state.uptime_ms / 3_600_000)}h ${Math.floor((state.uptime_ms % 3_600_000) / 60_000)}m`
    : '—';

  const riskColor = state.risk_level === 'critical' ? 'text-destructive' : state.risk_level === 'high' ? 'text-orange-500' : state.risk_level === 'medium' ? 'text-amber-500' : 'text-emerald-500';

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Status do Sistema
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1.5 h-8">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health + Uptime + Phase + Risk */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <HealthIndicator health={state.health} />
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="font-mono text-foreground font-semibold">{uptimeStr}</div>
              <div className="text-[10px] text-muted-foreground">Uptime</div>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="text-xs">{state.runtime_phase}</Badge>
              <div className="text-[10px] text-muted-foreground mt-0.5">Fase</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${riskColor}`}>{state.overall_risk_score}</div>
              <div className="text-[10px] text-muted-foreground">Risco</div>
            </div>
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <MiniStat icon={<Server className="h-3.5 w-3.5" />} label="Serviços" value={state.total_services} />
          <MiniStat icon={<Cpu className="h-3.5 w-3.5" />} label="Módulos" value={`${state.active_modules}/${state.total_modules}`} alert={state.error_modules > 0} />
          <MiniStat icon={<Zap className="h-3.5 w-3.5" />} label="Features" value={`${state.active_features}/${state.total_features}`} />
          <MiniStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Erros (1h)" value={state.observability.total_errors_last_hour} alert={state.observability.total_errors_last_hour > 10} />
          <MiniStat icon={<Brain className="h-3.5 w-3.5" />} label="Insights Gov." value={state.governance.total_insights} alert={state.governance.critical_insights > 0} />
          <MiniStat icon={<Heart className="h-3.5 w-3.5" />} label="Self-Healing" value={state.self_healing.enabled ? 'ON' : 'OFF'} />
        </div>

        {/* Subsystem health bar */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Subsistemas</div>
          <div className="flex flex-wrap gap-1.5">
            {state.subsystem_health.map(sub => (
              <Badge
                key={sub.name}
                variant="outline"
                className={`text-[10px] gap-1 ${sub.status === 'ok' ? 'border-emerald-500/40 text-emerald-600' : sub.status === 'warn' ? 'border-amber-500/40 text-amber-600' : 'border-destructive/40 text-destructive'}`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${sub.status === 'ok' ? 'bg-emerald-500' : sub.status === 'warn' ? 'bg-amber-500' : 'bg-destructive'}`} />
                {sub.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
