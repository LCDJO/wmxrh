/**
 * FABPerformanceInsights — Shows performance of Features, Advantages, Benefits content.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABMetric {
  label: string;
  type: 'feature' | 'advantage' | 'benefit';
  ctr: number;
  ctrDelta: number;
  impressions: number;
  conversions: number;
}

const MOCK_METRICS: FABMetric[] = [
  { label: 'Multi-tenant Avançado', type: 'feature', ctr: 4.2, ctrDelta: 0.8, impressions: 12400, conversions: 521 },
  { label: 'Gestão Centralizada', type: 'advantage', ctr: 5.7, ctrDelta: 1.2, impressions: 9800, conversions: 559 },
  { label: 'Redução de Custos', type: 'benefit', ctr: 7.1, ctrDelta: -0.3, impressions: 11200, conversions: 795 },
  { label: 'eSocial Automático', type: 'feature', ctr: 3.9, ctrDelta: 0.0, impressions: 8700, conversions: 339 },
  { label: 'Compliance LGPD', type: 'advantage', ctr: 6.3, ctrDelta: 2.1, impressions: 7500, conversions: 473 },
  { label: 'ROI em 30 Dias', type: 'benefit', ctr: 8.4, ctrDelta: 1.5, impressions: 10300, conversions: 865 },
];

const TYPE_COLORS: Record<string, string> = {
  feature: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  advantage: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  benefit: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

export function FABPerformanceInsights() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Performance FAB</CardTitle>
          <div className="flex gap-1.5">
            {(['feature', 'advantage', 'benefit'] as const).map(t => (
              <Badge key={t} variant="outline" className={cn('text-[9px] capitalize', TYPE_COLORS[t])}>
                {t === 'feature' ? 'F' : t === 'advantage' ? 'A' : 'B'}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {MOCK_METRICS.map((m, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
            <Badge variant="outline" className={cn('text-[9px] w-5 h-5 p-0 flex items-center justify-center', TYPE_COLORS[m.type])}>
              {m.type[0].toUpperCase()}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {m.impressions.toLocaleString('pt-BR')} impressões · {m.conversions.toLocaleString('pt-BR')} conversões
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">{m.ctr}%</p>
              <div className={cn(
                'flex items-center gap-0.5 text-[10px] font-medium',
                m.ctrDelta > 0 ? 'text-emerald-600' : m.ctrDelta < 0 ? 'text-red-500' : 'text-muted-foreground'
              )}>
                {m.ctrDelta > 0 ? <TrendingUp className="h-3 w-3" /> : m.ctrDelta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {m.ctrDelta > 0 ? '+' : ''}{m.ctrDelta}%
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
