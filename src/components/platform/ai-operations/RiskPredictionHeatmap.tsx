import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PredictedRisk } from '@/domains/autonomous-operations/types';

function scoreColor(score: number) {
  if (score >= 60) return 'bg-destructive/80 text-destructive-foreground';
  if (score >= 30) return 'bg-amber-500/80 text-white';
  return 'bg-primary/30 text-primary-foreground';
}

function scoreBorder(score: number) {
  if (score >= 60) return 'border-destructive/40';
  if (score >= 30) return 'border-amber-500/40';
  return 'border-primary/20';
}

interface Props {
  risks: PredictedRisk[];
}

export function RiskPredictionHeatmap({ risks }: Props) {
  const sorted = [...risks].sort((a, b) => b.composite_score - a.composite_score);
  const top = sorted.slice(0, 8);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Heatmap de Riscos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum risco previsto.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {top.map(r => (
              <div key={r.id} className={cn('rounded-lg border p-3 space-y-1.5', scoreBorder(r.composite_score))}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{r.category}</span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', scoreColor(r.composite_score))}>
                    {r.composite_score}
                  </span>
                </div>
                <p className="text-xs text-foreground font-medium leading-tight">{r.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>P: {r.probability}%</span>
                  <span>I: {r.impact_score}</span>
                  <span>⏳ {r.horizon_hours}h</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
