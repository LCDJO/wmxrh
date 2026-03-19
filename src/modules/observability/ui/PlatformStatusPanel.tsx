/**
 * Platform Status — Overall health dashboard with KPI strip and log stream.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { getErrorTracker } from '@/domains/observability/error-tracker';
import { getPerformanceProfiler } from '@/domains/observability/performance-profiler';
import { getSecurityEventCollector } from '@/domains/observability/security-event-collector';
import { getLogStreamAdapter, type LogEntry } from '@/domains/observability/log-stream-adapter';
import { exportPrometheus } from '@/domains/observability/grafana-integration-adapter';
import type { PlatformHealthSummary, HealthStatus } from '@/domains/observability/types';
import {
  Activity, CheckCircle2, XCircle, MinusCircle, Download,
  RefreshCw, Loader2, Shield, Bug, Cpu, Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/core/use-toast';

const statusConfig: Record<HealthStatus, { label: string; color: string; icon: typeof Heart }> = {
  healthy: { label: 'Saudável', color: 'text-emerald-500', icon: CheckCircle2 },
  degraded: { label: 'Degradado', color: 'text-[hsl(38_92%_40%)]', icon: MinusCircle },
  down: { label: 'Indisponível', color: 'text-destructive', icon: XCircle },
  unknown: { label: 'Desconhecido', color: 'text-muted-foreground', icon: MinusCircle },
};

const logLevelColor: Record<string, string> = {
  debug: 'text-muted-foreground',
  info: 'text-primary',
  warn: 'text-[hsl(38_92%_40%)]',
  error: 'text-destructive',
  fatal: 'text-destructive font-bold',
};

export default function PlatformStatusPanel() {
  const { toast } = useToast();
  const [health, setHealth] = useState<PlatformHealthSummary | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [exporting, setExporting] = useState(false);

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

    const logAdapter = getLogStreamAdapter();
    // Seed some demo logs if empty
    const current = logAdapter.query({ limit: 1 });
    if (current.length === 0) {
      logAdapter.info('platform', 'Platform boot completed');
      logAdapter.info('module', 'Module "Core" registered', { module_id: 'core' });
      logAdapter.warn('security', 'Rate limit threshold at 80%');
      logAdapter.info('module', 'Module "IAM" heartbeat OK', { module_id: 'iam' });
    }
    setLogs(logAdapter.query({ limit: 50 }));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    const unsub = getHealthMonitor().onUpdate(() => setHealth(getHealthMonitor().getSummary()));
    const logUnsub = getLogStreamAdapter().onEntry(() => {
      setLogs(getLogStreamAdapter().query({ limit: 50 }));
    });
    return () => { clearInterval(interval); unsub(); logUnsub(); };
  }, [refresh]);

  const errors1h = getErrorTracker().getSummary().total_errors_1h;
  const secDenied = getSecurityEventCollector().getEvents({ result: 'denied' }).length;
  const perf = getPerformanceProfiler().getSummary();

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = exportPrometheus();
      const blob = new Blob([result.text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics-${Date.now()}.prom`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportado', description: 'Métricas Prometheus exportadas.' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao exportar.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }, [toast]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                {(() => { const c = statusConfig[health.overall]; const I = c.icon; return <I className={cn('h-5 w-5', c.color)} />; })()}
                <div>
                  <p className="text-lg font-bold text-foreground">{statusConfig[health.overall].label}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Status Geral</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-lg font-bold text-foreground">{health.healthy_count}/{health.total_modules}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Módulos OK</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-lg font-bold text-foreground">{errors1h}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros / 1h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-lg font-bold text-foreground">{secDenied}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Acessos Negados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-lg font-bold text-foreground">{perf.current?.memory_used_mb ?? 0} MB</p>
              <p className="text-[10px] text-muted-foreground uppercase">Memória</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
          Exportar Prometheus
        </Button>
      </div>

      {/* Log Stream */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Log Stream
          </CardTitle>
          <CardDescription>Logs estruturados em tempo real de todos os subsistemas</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 font-mono text-xs">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-2 py-1 border-b border-border/30">
                    <span className="text-muted-foreground shrink-0 w-[72px]">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                    <Badge variant="outline" className="text-[9px] shrink-0 w-[52px] justify-center">
                      {log.level.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] shrink-0">
                      {log.source}
                    </Badge>
                    <span className={cn('min-w-0', logLevelColor[log.level] ?? 'text-foreground')}>
                      {log.module_id && <span className="text-muted-foreground">[{log.module_id}] </span>}
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum log capturado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
