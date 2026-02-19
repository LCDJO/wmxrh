/**
 * AIOperationsCenterWidget — Control Plane integration for the AI Operations Center.
 * Shows: recomendações ativas, alertas inteligentes, otimizações sugeridas.
 * Links to the full /platform/ai-operations dashboard.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Zap, ShieldAlert, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIOperationsData } from '@/hooks/useAIOperationsData';
import type { AutomationSuggestion, PredictedRisk, RevenueOptimization } from '@/domains/autonomous-operations/types';

export function AIOperationsCenterWidget() {
  const navigate = useNavigate();
  const { data, isLoading } = useAIOperationsData();

  const suggestions = data?.suggestions ?? [];
  const risks = data?.risks ?? [];
  const revenueOpts = data?.revenueOpts ?? [];

  const pending = suggestions.filter(s => s.status === 'pending');
  const criticalRisks = risks.filter(r => r.composite_score >= 60);

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/[0.02]">
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Carregando AI Operations…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">AI Operations Center</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => navigate('/platform/ai-operations')}
          >
            Dashboard Completo <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Zap className="h-3 w-3" /> {pending.length} recomendações
          </Badge>
          <Badge variant={criticalRisks.length > 0 ? 'destructive' : 'secondary'} className="text-xs gap-1">
            <ShieldAlert className="h-3 w-3" /> {risks.length} alertas
          </Badge>
          <Badge variant="secondary" className="text-xs gap-1">
            <TrendingUp className="h-3 w-3" /> {revenueOpts.length} otimizações
          </Badge>
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Recomendações Ativas */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> Recomendações Ativas
            </h4>
            <ScrollArea className="h-[140px]">
              <div className="space-y-1.5">
                {pending.slice(0, 4).map(s => (
                  <SuggestionMini key={s.id} suggestion={s} />
                ))}
                {pending.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">Nenhuma recomendação.</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Alertas Inteligentes */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" /> Alertas Inteligentes
            </h4>
            <ScrollArea className="h-[140px]">
              <div className="space-y-1.5">
                {risks.sort((a, b) => b.composite_score - a.composite_score).slice(0, 4).map(r => (
                  <RiskMini key={r.id} risk={r} />
                ))}
                {risks.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">Nenhum alerta.</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Otimizações Sugeridas */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Otimizações Sugeridas
            </h4>
            <ScrollArea className="h-[140px]">
              <div className="space-y-1.5">
                {revenueOpts.slice(0, 4).map(o => (
                  <OptimizationMini key={o.id} optimization={o} />
                ))}
                {revenueOpts.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">Nenhuma otimização.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Mini cards ──

function SuggestionMini({ suggestion }: { suggestion: AutomationSuggestion }) {
  const priorityColor = suggestion.priority === 'critical' ? 'text-destructive'
    : suggestion.priority === 'high' ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <div className="rounded border border-border/60 p-2">
      <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-2">{suggestion.title}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className={cn('text-[9px] font-semibold uppercase', priorityColor)}>{suggestion.priority}</span>
        <span className="text-[9px] text-muted-foreground truncate">{suggestion.estimated_impact}</span>
      </div>
    </div>
  );
}

function RiskMini({ risk }: { risk: PredictedRisk }) {
  const color = risk.composite_score >= 60 ? 'border-destructive/40' : risk.composite_score >= 30 ? 'border-amber-500/40' : 'border-border/60';
  const scoreColor = risk.composite_score >= 60 ? 'text-destructive' : risk.composite_score >= 30 ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <div className={cn('rounded border p-2', color)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-1 flex-1">{risk.title}</p>
        <span className={cn('text-[10px] font-bold ml-1 shrink-0', scoreColor)}>{risk.composite_score}</span>
      </div>
      <p className="text-[9px] text-muted-foreground mt-0.5">{risk.category} • {risk.horizon_hours}h</p>
    </div>
  );
}

function OptimizationMini({ optimization }: { optimization: RevenueOptimization }) {
  const positive = optimization.estimated_mrr_impact >= 0;
  return (
    <div className="rounded border border-border/60 p-2">
      <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-1">{optimization.tenant_name}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className={cn('text-[9px] font-semibold', positive ? 'text-emerald-600' : 'text-destructive')}>
          {positive ? '+' : ''}R${optimization.estimated_mrr_impact.toFixed(0)}
        </span>
        <span className="text-[9px] text-muted-foreground">{optimization.recommended_action.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
}
