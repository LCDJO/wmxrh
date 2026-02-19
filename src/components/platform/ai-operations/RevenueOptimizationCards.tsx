import { DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RevenueOptimization } from '@/domains/autonomous-operations/types';

const actionLabels: Record<string, string> = {
  upgrade: 'Upgrade',
  add_module: 'Add módulo',
  increase_usage: 'Aumentar uso',
  retention_offer: 'Retenção',
  cross_sell: 'Cross-sell',
};

interface Props {
  optimizations: RevenueOptimization[];
}

export function RevenueOptimizationCards({ optimizations }: Props) {
  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          Otimizações de Receita
          <Badge variant="secondary" className="ml-auto text-xs">{optimizations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
        {optimizations.map(o => {
          const positive = o.estimated_mrr_impact >= 0;
          return (
            <div key={o.id} className="rounded-lg border border-border p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{o.tenant_name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{actionLabels[o.recommended_action] ?? o.recommended_action}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{o.reasoning}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className={cn('flex items-center gap-0.5 font-semibold', positive ? 'text-emerald-600' : 'text-destructive')}>
                  {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  R${Math.abs(o.estimated_mrr_impact).toFixed(2)}
                </span>
                <span className="text-muted-foreground">Confiança: {o.confidence}%</span>
              </div>
            </div>
          );
        })}
        {optimizations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma otimização disponível.</p>
        )}
      </CardContent>
    </Card>
  );
}
