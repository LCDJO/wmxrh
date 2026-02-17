/**
 * ABTestHeatmap — Grid heatmap of experiments × metrics showing relative performance.
 */
import { useState, useEffect } from 'react';
import { Grid3X3, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { abTestingManager } from '@/domains/platform-growth/autonomous-marketing/ab-testing-manager';
import type { ABExperiment } from '@/domains/platform-growth/autonomous-marketing/types';

type HeatCell = {
  experiment: string;
  variant: string;
  metric: string;
  value: number;
  normalized: number; // 0-1
  isControl: boolean;
};

const METRICS = ['conversionRate', 'bounceRate', 'avgTimeOnPage', 'revenue'] as const;
const METRIC_LABELS: Record<string, string> = {
  conversionRate: 'Conv %',
  bounceRate: 'Bounce %',
  avgTimeOnPage: 'Tempo (s)',
  revenue: 'Receita',
};

export default function ABTestHeatmap() {
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const running = abTestingManager.listByStatus('running');
      const completed = abTestingManager.listByStatus('completed');
      const exps = [...running, ...completed].slice(0, 6);
      setExperiments(exps);

      const allCells: HeatCell[] = [];

      for (const metric of METRICS) {
        const allValues = exps.flatMap(e => e.variants.map(v => v.metrics[metric] as number));
        const max = Math.max(...allValues, 1);
        const min = Math.min(...allValues, 0);
        const range = max - min || 1;

        for (const exp of exps) {
          for (const v of exp.variants) {
            const value = v.metrics[metric] as number;
            // For bounceRate, invert (lower is better)
            const normalized = metric === 'bounceRate'
              ? 1 - (value - min) / range
              : (value - min) / range;

            allCells.push({
              experiment: exp.name,
              variant: v.name,
              metric,
              value,
              normalized,
              isControl: v.isControl,
            });
          }
        }
      }

      setCells(allCells);
    } catch (e) {
      console.error('ABTestHeatmap error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const getHeatColor = (normalized: number): string => {
    if (normalized >= 0.8) return 'bg-emerald-500/80 text-white';
    if (normalized >= 0.6) return 'bg-emerald-400/60 text-foreground';
    if (normalized >= 0.4) return 'bg-amber-400/50 text-foreground';
    if (normalized >= 0.2) return 'bg-orange-400/50 text-foreground';
    return 'bg-destructive/40 text-foreground';
  };

  const formatValue = (metric: string, value: number): string => {
    if (metric === 'revenue') return `R$${value.toFixed(0)}`;
    if (metric === 'avgTimeOnPage') return `${value.toFixed(0)}s`;
    return `${value.toFixed(1)}%`;
  };

  // Get unique variants across all experiments
  const variantRows = experiments.flatMap(e =>
    e.variants.map(v => ({
      key: `${e.id}-${v.id}`,
      expName: e.name.length > 15 ? e.name.slice(0, 15) + '…' : e.name,
      varName: v.name,
      isControl: v.isControl,
      expId: e.id,
      varId: v.id,
    }))
  );

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-primary" />
          A/B Test Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        {variantRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Grid3X3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum experimento para exibir.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground min-w-[160px]">Experimento / Variante</th>
                  {METRICS.map(m => (
                    <th key={m} className="text-center p-2 font-medium text-muted-foreground min-w-[80px]">
                      {METRIC_LABELS[m]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variantRows.map(row => (
                  <tr key={row.key} className="border-t border-border/30">
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{row.expName}</span>
                        <span className="text-foreground font-medium">/ {row.varName}</span>
                        {row.isControl && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">CTL</span>
                        )}
                      </div>
                    </td>
                    {METRICS.map(metric => {
                      const cell = cells.find(
                        c => c.experiment === experiments.find(e => e.id === row.expId)?.name
                          && c.variant === row.varName
                          && c.metric === metric
                      );
                      if (!cell) return <td key={metric} className="p-2 text-center">—</td>;
                      return (
                        <td key={metric} className="p-1.5">
                          <div className={cn(
                            'text-center py-1.5 px-2 rounded-md font-mono text-[11px] font-medium transition-colors',
                            getHeatColor(cell.normalized)
                          )}>
                            {formatValue(metric, cell.value)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 justify-center">
          <span className="text-[10px] text-muted-foreground">Pior</span>
          {['bg-destructive/40', 'bg-orange-400/50', 'bg-amber-400/50', 'bg-emerald-400/60', 'bg-emerald-500/80'].map((c, i) => (
            <div key={i} className={cn('w-5 h-3 rounded-sm', c)} />
          ))}
          <span className="text-[10px] text-muted-foreground">Melhor</span>
        </div>
      </CardContent>
    </Card>
  );
}
