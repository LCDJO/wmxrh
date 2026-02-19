/**
 * ApiTrafficMonitorWidget — Control Plane widget for real-time API traffic overview.
 * Shows request volume, error rate, rate-limited count, and latency.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, AlertTriangle, Gauge, Clock, TrendingUp, ShieldAlert } from 'lucide-react';

interface ApiTrafficStats {
  totalRequests: number;
  errorsTotal: number;
  rateLimitedTotal: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: string;
  topEndpoints: { path: string; count: number; avgMs: number }[];
}

function useApiTrafficStats(): ApiTrafficStats {
  // Mock data — in production, fetched from api_usage_logs or Prometheus
  return {
    totalRequests: 48_291,
    errorsTotal: 142,
    rateLimitedTotal: 87,
    avgLatencyMs: 138,
    p95LatencyMs: 412,
    errorRate: '0.29%',
    topEndpoints: [
      { path: '/api/v1/hr/employees', count: 12_840, avgMs: 94 },
      { path: '/api/v1/billing/invoices', count: 8_210, avgMs: 127 },
      { path: '/api/v2/compensation/salary', count: 6_442, avgMs: 156 },
      { path: '/api/v1/health/exams', count: 4_102, avgMs: 203 },
      { path: '/api/v1/compliance/rules', count: 2_890, avgMs: 89 },
    ],
  };
}

export function ApiTrafficMonitorWidget() {
  const stats = useApiTrafficStats();

  const kpis = [
    { label: 'Requests', value: stats.totalRequests.toLocaleString(), icon: TrendingUp, color: 'text-primary' },
    { label: 'Errors (5xx)', value: stats.errorsTotal.toLocaleString(), icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Rate Limited', value: stats.rateLimitedTotal.toLocaleString(), icon: ShieldAlert, color: 'text-warning' },
    { label: 'Avg Latency', value: `${stats.avgLatencyMs}ms`, icon: Clock, color: 'text-muted-foreground' },
    { label: 'P95 Latency', value: `${stats.p95LatencyMs}ms`, icon: Gauge, color: 'text-muted-foreground' },
    { label: 'Error Rate', value: stats.errorRate, icon: AlertTriangle, color: stats.errorsTotal > 200 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">API Traffic Monitor</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px]">PAMS</Badge>
        </div>
        <CardDescription>Visão consolidada de tráfego, erros e latência da API.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="text-center space-y-1">
                <Icon className={`h-4 w-4 mx-auto ${k.color}`} />
                <div className="text-lg font-bold">{k.value}</div>
                <div className="text-[10px] text-muted-foreground">{k.label}</div>
              </div>
            );
          })}
        </div>

        {/* Top endpoints */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Top Endpoints (24h)</h4>
          <div className="space-y-1.5">
            {stats.topEndpoints.map((ep, i) => {
              const pct = (ep.count / stats.totalRequests) * 100;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground w-52 truncate">{ep.path}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="w-14 text-right tabular-nums">{ep.count.toLocaleString()}</span>
                  <span className="w-12 text-right text-muted-foreground tabular-nums">{ep.avgMs}ms</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
