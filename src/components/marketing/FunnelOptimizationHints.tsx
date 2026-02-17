/**
 * FunnelOptimizationHints — Displays GrowthAI-powered optimization
 * hints for a specific MarketingFunnel, combining conversion risk
 * analysis and stage-level recommendations.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Zap, AlertTriangle, TrendingDown, ArrowRight, Sparkles, Loader2, CheckCircle2,
} from 'lucide-react';
import {
  growthAISupportLayer,
  type MarketingFunnel,
  type FunnelHealth,
  type ConversionRiskAnalysis,
} from '@/domains/marketing-digital-os';
import type { LandingPage } from '@/domains/platform-growth/types';
import { cn } from '@/lib/utils';

interface FunnelOptimizationHintsProps {
  funnel: MarketingFunnel;
  funnelHealth: FunnelHealth;
  page?: LandingPage;
  className?: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-warning/15 text-warning border-warning/30',
  medium: 'bg-accent/15 text-accent-foreground border-accent/30',
  low: 'bg-success/15 text-success border-success/30',
};

export function FunnelOptimizationHints({ funnel, funnelHealth, page, className }: FunnelOptimizationHintsProps) {
  const [riskAnalysis, setRiskAnalysis] = useState<ConversionRiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = () => {
    if (!page) return;
    setLoading(true);
    const result = growthAISupportLayer.analyzeConversionRisk(page);
    setRiskAnalysis(result);
    setLoading(false);
  };

  return (
    <Card className={cn('border-primary/20', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">Otimização do Funil</CardTitle>
          </div>
          <Badge variant="outline" className={cn('text-[9px]', RISK_COLORS[riskAnalysis?.riskLevel ?? 'medium'])}>
            {riskAnalysis ? `Risco: ${riskAnalysis.riskLevel}` : `Score: ${funnel.overallConversionRate}%`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Weakest stage highlight */}
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2">
          <TrendingDown className="h-4 w-4 text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-card-foreground">
              Maior gargalo: <span className="text-warning">{funnelHealth.weakestStage}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {funnelHealth.dropoffRate}% de dropoff — {funnelHealth.recommendation}
            </p>
          </div>
        </div>

        {/* Stage-by-stage mini funnel */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fluxo do Funil</p>
          <div className="flex items-center gap-1 flex-wrap">
            {funnel.stages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-1">
                <div className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium border',
                  stage.name === funnelHealth.weakestStage
                    ? 'border-warning/50 bg-warning/10 text-warning'
                    : stage.conversionFromPrevious >= 50
                      ? 'border-success/30 bg-success/5 text-success'
                      : 'border-border bg-muted/30 text-muted-foreground'
                )}>
                  {stage.name}
                  <span className="ml-1 text-[8px] opacity-70">
                    {i === 0 ? stage.count : `${stage.conversionFromPrevious}%`}
                  </span>
                </div>
                {i < funnel.stages.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Analysis */}
        {page && (
          <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1" onClick={analyze} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Analisar riscos com Growth AI
          </Button>
        )}

        {riskAnalysis && (
          <div className="space-y-2">
            {/* Score & Grade */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all',
                    riskAnalysis.overallScore >= 75 ? 'bg-success' :
                    riskAnalysis.overallScore >= 50 ? 'bg-warning' : 'bg-destructive'
                  )}
                  style={{ width: `${riskAnalysis.overallScore}%` }}
                />
              </div>
              <span className="text-xs font-bold text-card-foreground">{riskAnalysis.overallScore}/100</span>
              <Badge variant="outline" className="text-[9px]">{riskAnalysis.grade}</Badge>
            </div>

            {/* Recommendation */}
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <p className="text-[10px] text-card-foreground">{riskAnalysis.recommendation}</p>
            </div>

            {/* Risks */}
            {riskAnalysis.risks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Riscos identificados:</p>
                {riskAnalysis.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px]">
                    <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{r.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Funnel dropoffs */}
            {riskAnalysis.funnelDropoffs.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Dropoffs por estágio:</p>
                {riskAnalysis.funnelDropoffs.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{d.stage}</span>
                    <Badge variant="outline" className={cn('text-[8px]',
                      d.rate > 70 ? 'border-destructive/30 text-destructive' :
                      d.rate > 40 ? 'border-warning/30 text-warning' :
                      'border-success/30 text-success'
                    )}>
                      {d.rate}% dropoff
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {riskAnalysis.riskLevel === 'low' && (
              <div className="flex items-center gap-1.5 text-[10px] text-success">
                <CheckCircle2 className="h-3 w-3" />
                Funil saudável — considere micro-otimizações via A/B test
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
