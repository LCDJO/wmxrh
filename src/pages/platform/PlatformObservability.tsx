/**
 * PlatformObservability — Grafana-style observability dashboard.
 *
 * Panels: Module Health, Security Events, Error Tracking, Performance.
 * Includes Prometheus metrics export.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { getErrorTracker } from '@/domains/observability/error-tracker';
import { getPerformanceProfiler } from '@/domains/observability/performance-profiler';
import { getSecurityEventCollector } from '@/domains/observability/security-event-collector';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import type { PlatformHealthSummary, ErrorSummary, PerformanceSummary, SecurityEvent, HealthStatus } from '@/domains/observability/types';
import {
  Activity, AlertTriangle, Bug, Cpu, Download,
  Heart, Loader2, RefreshCw, Shield, Zap,
  CheckCircle2, XCircle, MinusCircle, Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';

const statusConfig: Record<HealthStatus, { label: string; color: string; icon: typeof Heart }> = {
  healthy: { label: 'Saudável', color: 'text-emerald-500', icon: CheckCircle2 },
  degraded: { label: 'Degradado', color: 'text-[hsl(38_92%_40%)]', icon: MinusCircle },
  down: { label: 'Indisponível', color: 'text-destructive', icon: XCircle },
  unknown: { label: 'Desconhecido', color: 'text-muted-foreground', icon: MinusCircle },
};

export default function PlatformObservability() {
  const { toast } = useToast();
  const [health, setHealth] = useState<PlatformHealthSummary | null>(null);
  const [errors, setErrors] = useState<ErrorSummary | null>(null);
  const [perf, setPerf] = useState<PerformanceSummary | null>(null);
  const [secEvents, setSecEvents] = useState<SecurityEvent[]>([]);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(() => {
    const monitor = getHealthMonitor();
    const tracker = getErrorTracker();
    const profiler = getPerformanceProfiler();
    const security = getSecurityEventCollector();

    // Register some demo modules if empty
    const summary = monitor.getSummary();
    if (summary.total_modules === 0) {
      ['core', 'iam', 'payroll', 'compliance', 'esocial', 'analytics'].forEach(m => {
        monitor.registerModule(m, m.charAt(0).toUpperCase() + m.slice(1));
        monitor.heartbeat(m, Math.random() * 100);
      });
    }

    setHealth(monitor.getSummary());
    setErrors(tracker.getSummary());
    profiler.collect();
    setPerf(profiler.getSummary());
    setSecEvents(security.getEvents({ limit: 50 }));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);

    const unsub1 = getHealthMonitor().onUpdate(() => setHealth(getHealthMonitor().getSummary()));
    const unsub2 = getErrorTracker().onUpdate(() => setErrors(getErrorTracker().getSummary()));
    const unsub3 = getSecurityEventCollector().onUpdate(() => setSecEvents(getSecurityEventCollector().getEvents({ limit: 50 })));

    return () => {
      clearInterval(interval);
      unsub1();
      unsub2();
      unsub3();
    };
  }, [refresh]);

  const handleExportMetrics = useCallback(async () => {
    setExporting(true);
    try {
      const collector = getMetricsCollector();
      const prometheusMetrics = collector.toPrometheus();

      const { data, error } = await supabase.functions.invoke('metrics-export', {
        body: { metrics: prometheusMetrics, format: 'prometheus' },
      });

      if (error) throw error;

      // Download as file
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data)], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics-${Date.now()}.prom`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Exportado', description: 'Métricas exportadas no formato Prometheus.' });
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao exportar métricas.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }, [toast]);

  const perfHistory = (perf?.history ?? []).map((p, i) => ({
    t: i,
    load: p.page_load_ms,
    ttfb: p.ttfb_ms,
    memory: p.memory_used_mb,
    dom: p.dom_nodes,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Observability & Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real da plataforma — Grafana Ready
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button onClick={handleExportMetrics} disabled={exporting} size="sm" variant="outline">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Exportar Prometheus
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = statusConfig[health.overall];
                  const Icon = cfg.icon;
                  return <Icon className={cn("h-5 w-5", cfg.color)} />;
                })()}
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
              <p className="text-[10px] text-muted-foreground uppercase">Módulos Saudáveis</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-lg font-bold text-foreground">{errors?.total_errors_1h ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros / 1h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-lg font-bold text-foreground">{secEvents.filter(e => e.result === 'denied').length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Acessos Negados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-lg font-bold text-foreground">{perf?.current?.memory_used_mb ?? 0} MB</p>
              <p className="text-[10px] text-muted-foreground uppercase">Memória</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="health" className="text-xs gap-1">
            <Heart className="h-3.5 w-3.5" /> Health
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs gap-1">
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="errors" className="text-xs gap-1">
            <Bug className="h-3.5 w-3.5" /> Errors
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs gap-1">
            <Cpu className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
        </TabsList>

        {/* Module Health */}
        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Module Health</CardTitle>
              <CardDescription>Status de cada módulo federado da plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              {health && health.modules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {health.modules.map(mod => {
                    const cfg = statusConfig[mod.status];
                    const Icon = cfg.icon;
                    return (
                      <div key={mod.module_id} className="border border-border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{mod.module_label}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Icon className={cn("h-4 w-4", cfg.color)} />
                            <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xs font-bold text-foreground">{mod.latency_ms}ms</p>
                            <p className="text-[10px] text-muted-foreground">Latência</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{Math.round(mod.uptime_ms / 60000)}m</p>
                            <p className="text-[10px] text-muted-foreground">Uptime</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{mod.error_count_1h}</p>
                            <p className="text-[10px] text-muted-foreground">Erros/1h</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Server className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhum módulo registrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Events */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security Events</CardTitle>
              <CardDescription>Eventos de segurança capturados do Security Kernel</CardDescription>
            </CardHeader>
            <CardContent>
              {secEvents.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {secEvents.map(event => (
                      <div key={event.id} className="flex items-center gap-3 border border-border rounded-lg p-3">
                        <div className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          event.result === 'denied' ? 'bg-destructive' : event.result === 'flagged' ? 'bg-[hsl(38_92%_50%)]' : 'bg-emerald-500',
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{event.type}</Badge>
                            <span className="text-xs text-muted-foreground">{event.action}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {event.user_label ?? event.user_id ?? 'System'} → {event.resource}
                          </p>
                        </div>
                        <Badge variant={event.result === 'denied' ? 'destructive' : event.result === 'flagged' ? 'secondary' : 'default'} className="text-[10px] shrink-0">
                          {event.result}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(event.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhum evento de segurança registrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Tracking */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Error Tracking</CardTitle>
              <CardDescription>Erros capturados e agregados por fonte e severidade</CardDescription>
            </CardHeader>
            <CardContent>
              {errors && errors.top_errors.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold text-foreground">{errors.total_errors_24h}</p>
                      <p className="text-[10px] text-muted-foreground">Erros 24h</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold text-foreground">{errors.error_rate_per_min}</p>
                      <p className="text-[10px] text-muted-foreground">Erros/min</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold text-foreground">{Object.keys(errors.by_source).length}</p>
                      <p className="text-[10px] text-muted-foreground">Fontes</p>
                    </div>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {errors.top_errors.map(err => (
                        <div key={err.id} className="border border-border rounded-lg p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-mono text-foreground truncate">{err.message}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant={err.severity === 'fatal' || err.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                                {err.severity}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">×{err.count}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{err.source}</span>
                            {err.module_id && <span>• {err.module_id}</span>}
                            <span>• {new Date(err.last_seen).toLocaleTimeString('pt-BR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Bug className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhum erro registrado. 🎉</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Web Vitals</CardTitle>
                <CardDescription>Métricas de performance do navegador</CardDescription>
              </CardHeader>
              <CardContent>
                {perf?.current ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Page Load', value: `${perf.current.page_load_ms}ms`, good: perf.current.page_load_ms < 3000 },
                      { label: 'TTFB', value: `${perf.current.ttfb_ms}ms`, good: perf.current.ttfb_ms < 200 },
                      { label: 'FCP', value: `${perf.current.fcp_ms}ms`, good: perf.current.fcp_ms < 1800 },
                      { label: 'Memory', value: `${perf.current.memory_used_mb}MB`, good: perf.current.memory_used_mb < 100 },
                      { label: 'DOM Nodes', value: `${perf.current.dom_nodes}`, good: perf.current.dom_nodes < 1500 },
                      { label: 'JS Heap', value: `${perf.current.js_heap_mb}MB`, good: perf.current.js_heap_mb < 50 },
                    ].map(({ label, value, good }) => (
                      <div key={label} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <div className={cn("h-2 w-2 rounded-full", good ? "bg-emerald-500" : "bg-[hsl(38_92%_50%)]")} />
                        </div>
                        <p className="text-lg font-bold text-foreground mt-1">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Coletando métricas...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Timeline</CardTitle>
                <CardDescription>Histórico de métricas coletadas</CardDescription>
              </CardHeader>
              <CardContent>
                {perfHistory.length > 1 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={perfHistory}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="t" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="memory" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" name="Memory (MB)" />
                      <Area type="monotone" dataKey="dom" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.05)" name="DOM Nodes" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aguardando dados suficientes...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
