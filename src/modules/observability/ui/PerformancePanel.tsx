/**
 * Performance — Web Vitals, memory, and DOM stats with charts.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPerformanceProfiler } from '@/domains/observability/performance-profiler';
import type { PerformanceSummary } from '@/domains/observability/types';
import { Cpu, RefreshCw, Gauge, Clock, Box, MemoryStick } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface VitalConfig {
  label: string;
  value: string;
  good: boolean;
  unit: string;
  icon: typeof Cpu;
}

export default function PerformancePanel() {
  const [perf, setPerf] = useState<PerformanceSummary | null>(null);

  const refresh = useCallback(() => {
    const profiler = getPerformanceProfiler();
    profiler.collect();
    setPerf(profiler.getSummary());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const vitals: VitalConfig[] = perf?.current ? [
    { label: 'Page Load', value: `${perf.current.page_load_ms}`, good: perf.current.page_load_ms < 3000, unit: 'ms', icon: Clock },
    { label: 'TTFB', value: `${perf.current.ttfb_ms}`, good: perf.current.ttfb_ms < 200, unit: 'ms', icon: Gauge },
    { label: 'FCP', value: `${perf.current.fcp_ms}`, good: perf.current.fcp_ms < 1800, unit: 'ms', icon: Gauge },
    { label: 'Memory', value: `${perf.current.memory_used_mb}`, good: perf.current.memory_used_mb < 100, unit: 'MB', icon: MemoryStick },
    { label: 'JS Heap', value: `${perf.current.js_heap_mb}`, good: perf.current.js_heap_mb < 80, unit: 'MB', icon: Cpu },
    { label: 'DOM Nodes', value: `${perf.current.dom_nodes}`, good: perf.current.dom_nodes < 1500, unit: '', icon: Box },
  ] : [];

  const chartData = (perf?.history ?? []).map((p, i) => ({
    t: i,
    load: p.page_load_ms,
    ttfb: p.ttfb_ms,
    memory: p.memory_used_mb,
    dom: p.dom_nodes,
  }));

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Web Vitals & Runtime</h2>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Coletar
        </Button>
      </div>

      {/* Vital cards */}
      {vitals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {vitals.map(v => {
            const Icon = v.icon;
            return (
              <Card key={v.label}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase">{v.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className={cn('text-xl font-bold', v.good ? 'text-emerald-500' : 'text-destructive')}>
                      {v.value}
                    </p>
                    <span className="text-xs text-muted-foreground">{v.unit}</span>
                  </div>
                  <Badge variant={v.good ? 'default' : 'destructive'} className="text-[9px] mt-1">
                    {v.good ? 'Bom' : 'Atenção'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Averages */}
      {perf && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-xl font-bold text-foreground">{perf.avg_page_load_ms}ms</p>
              <p className="text-[10px] text-muted-foreground uppercase">Avg Page Load</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-xl font-bold text-foreground">{perf.p95_page_load_ms}ms</p>
              <p className="text-[10px] text-muted-foreground uppercase">P95 Page Load</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-xl font-bold text-foreground">{perf.avg_ttfb_ms}ms</p>
              <p className="text-[10px] text-muted-foreground uppercase">Avg TTFB</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page Load & TTFB</CardTitle>
              <CardDescription>Histórico de carregamento (ms)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" hide />
                  <YAxis width={50} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                  <Area type="monotone" dataKey="load" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" name="Page Load" />
                  <Area type="monotone" dataKey="ttfb" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted) / 0.3)" name="TTFB" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Memory & DOM</CardTitle>
              <CardDescription>Uso de memória (MB) e nós DOM</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" hide />
                  <YAxis width={50} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                  <Area type="monotone" dataKey="memory" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" name="Memory MB" />
                  <Area type="monotone" dataKey="dom" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted) / 0.3)" name="DOM Nodes" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
