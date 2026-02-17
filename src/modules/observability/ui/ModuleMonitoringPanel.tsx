/**
 * Module Monitoring — Health status per federated module.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import type { PlatformHealthSummary, ModuleHealthReport, HealthStatus } from '@/domains/observability/types';
import {
  Server, CheckCircle2, XCircle, MinusCircle, Heart, RefreshCw, Clock, Zap, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig: Record<HealthStatus, { label: string; color: string; bg: string; icon: typeof Heart }> = {
  healthy: { label: 'Saudável', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  degraded: { label: 'Degradado', color: 'text-[hsl(38_92%_40%)]', bg: 'bg-[hsl(38_92%_50%)]/10', icon: MinusCircle },
  down: { label: 'Indisponível', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
  unknown: { label: 'Desconhecido', color: 'text-muted-foreground', bg: 'bg-muted', icon: MinusCircle },
};

function formatUptime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ModuleMonitoringPanel() {
  const [health, setHealth] = useState<PlatformHealthSummary | null>(null);

  const refresh = useCallback(() => {
    const monitor = getHealthMonitor();
    const summary = monitor.getSummary();
    if (summary.total_modules === 0) {
      ['core', 'iam', 'payroll', 'compliance', 'esocial', 'analytics', 'observability'].forEach(m => {
        monitor.registerModule(m, m.charAt(0).toUpperCase() + m.slice(1));
        monitor.heartbeat(m, Math.random() * 100);
      });
    }
    setHealth(monitor.getSummary());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    const unsub = getHealthMonitor().onUpdate(() => setHealth(getHealthMonitor().getSummary()));
    return () => { clearInterval(interval); unsub(); };
  }, [refresh]);

  if (!health) return null;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-foreground">{health.total_modules}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{health.healthy_count}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Saudáveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-[hsl(38_92%_40%)]">{health.degraded_count}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Degradados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-destructive">{health.down_count}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Indisponíveis</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Módulos Registrados</h2>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health.modules.map(mod => {
          const cfg = statusConfig[mod.status];
          const Icon = cfg.icon;
          const healthPct = mod.status === 'healthy' ? 100 : mod.status === 'degraded' ? 50 : 0;

          return (
            <Card key={mod.module_id}>
              <CardContent className="pt-5 pb-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{mod.module_label}</span>
                  </div>
                  <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg)}>
                    <Icon className={cn('h-3 w-3', cfg.color)} />
                    <span className={cfg.color}>{cfg.label}</span>
                  </div>
                </div>

                {/* Health bar */}
                <Progress value={healthPct} className="h-1.5" />

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{mod.latency_ms}ms</p>
                      <p className="text-[9px] text-muted-foreground">Latência</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{formatUptime(mod.uptime_ms)}</p>
                      <p className="text-[9px] text-muted-foreground">Uptime</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{mod.error_count_1h}</p>
                      <p className="text-[9px] text-muted-foreground">Erros/1h</p>
                    </div>
                  </div>
                </div>

                {/* Last heartbeat */}
                <p className="text-[10px] text-muted-foreground">
                  Último heartbeat: {new Date(mod.last_heartbeat).toLocaleTimeString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
