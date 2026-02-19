/**
 * AutomationSystemHealthWidget — Control Plane widget showing
 * workflow execution health, failure rate, latency, and active workflows.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Workflow, AlertTriangle, CheckCircle2, Clock, Activity, Zap } from 'lucide-react';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import { cn } from '@/lib/utils';

interface WorkflowHealthMetrics {
  executionsTotal: number;
  failuresTotal: number;
  activeWorkflows: number;
  avgLatencyMs: number;
  failureRate: number;
  status: 'healthy' | 'degraded' | 'critical';
}

function useWorkflowHealth(): WorkflowHealthMetrics {
  const [metrics, setMetrics] = useState<WorkflowHealthMetrics>({
    executionsTotal: 0,
    failuresTotal: 0,
    activeWorkflows: 0,
    avgLatencyMs: 0,
    failureRate: 0,
    status: 'healthy',
  });

  useEffect(() => {
    const collect = () => {
      const mc = getMetricsCollector();
      const exec = mc.getLatest('workflow_executions_total')?.value ?? 0;
      const fail = mc.getLatest('workflow_failures_total')?.value ?? 0;
      const active = mc.getLatest('automation_active_workflows')?.value ?? 0;
      const lat = mc.getLatest('workflow_latency_avg_ms')?.value ?? 0;
      const rate = exec > 0 ? (fail / exec) * 100 : 0;
      const status = rate > 20 ? 'critical' : rate > 5 ? 'degraded' : 'healthy';
      setMetrics({ executionsTotal: exec, failuresTotal: fail, activeWorkflows: active, avgLatencyMs: lat, failureRate: rate, status });
    };
    collect();
    const interval = setInterval(collect, 10_000);
    return () => clearInterval(interval);
  }, []);

  return metrics;
}

const STATUS_CONFIG = {
  healthy: { label: 'Saudável', color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle2 },
  degraded: { label: 'Degradado', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: AlertTriangle },
  critical: { label: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertTriangle },
};

export function AutomationSystemHealthWidget() {
  const m = useWorkflowHealth();
  const cfg = STATUS_CONFIG[m.status];
  const StatusIcon = cfg.icon;

  const kpis = useMemo(() => [
    { label: 'Execuções', value: m.executionsTotal, icon: Activity, color: 'text-blue-500' },
    { label: 'Falhas', value: m.failuresTotal, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Ativos', value: m.activeWorkflows, icon: Zap, color: 'text-green-500' },
    { label: 'Latência Média', value: `${m.avgLatencyMs.toFixed(0)}ms`, icon: Clock, color: 'text-amber-500' },
  ], [m]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-4.5 w-4.5 text-primary" />
            <CardTitle className="text-base font-display">Automation System Health</CardTitle>
          </div>
          <Badge className={cn('text-[10px] gap-1', cfg.bg, cfg.color)}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-3">
          {kpis.map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="text-center">
                <Icon className={cn('h-4 w-4 mx-auto mb-1', kpi.color)} />
                <div className="text-lg font-bold font-display">{kpi.value}</div>
                <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
              </div>
            );
          })}
        </div>

        {/* Failure Rate Bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Taxa de Falha</span>
            <span className={cn('text-xs font-medium', m.failureRate > 20 ? 'text-red-500' : m.failureRate > 5 ? 'text-amber-500' : 'text-green-500')}>
              {m.failureRate.toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.min(m.failureRate, 100)} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
