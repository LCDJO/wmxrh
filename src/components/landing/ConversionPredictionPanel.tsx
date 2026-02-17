/**
 * ConversionPredictionPanel — Revenue impact prediction for Landing Pages.
 * Uses GrowthAISupportLayer.predictRevenueImpact() to show projected
 * MRR changes, churn risk reduction, and upgrade potential.
 */
import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { growthAISupportLayer, type RevenueImpactPrediction } from '@/domains/platform-growth/growth-ai-support-layer';
import type { LandingPage } from '@/domains/platform-growth/types';

interface ConversionPredictionPanelProps {
  page: LandingPage;
}

export function ConversionPredictionPanel({ page }: ConversionPredictionPanelProps) {
  const [prediction, setPrediction] = useState<RevenueImpactPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    growthAISupportLayer
      .predictRevenueImpact(page.id, page)
      .then(setPrediction)
      .finally(() => setLoading(false));
  }, [page.id, page]);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Calculando impacto financeiro…</span>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  const isPositive = prediction.projectedMRRChangePct >= 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Previsão de Impacto Financeiro
          <Badge variant="outline" className="ml-auto text-[9px]">
            {prediction.confidenceLevel}% confiança
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <MetricBox
            label="MRR Atual"
            value={`R$ ${prediction.currentMRR.toLocaleString()}`}
            icon={<DollarSign className="h-3.5 w-3.5" />}
          />
          <MetricBox
            label="Impacto Projetado"
            value={`${isPositive ? '+' : ''}R$ ${prediction.projectedMRRChange.toLocaleString()}`}
            subValue={`${isPositive ? '+' : ''}${prediction.projectedMRRChangePct}%`}
            icon={isPositive
              ? <TrendingUp className="h-3.5 w-3.5 text-success" />
              : <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            }
            accent={isPositive ? 'success' : 'destructive'}
          />
          <MetricBox
            label="Redução Risco Churn"
            value={`-${prediction.churnRiskReduction}%`}
            icon={<ShieldCheck className="h-3.5 w-3.5 text-success" />}
            accent="success"
          />
          <MetricBox
            label="Potencial Upgrade"
            value={`R$ ${prediction.upgradePotentialBRL.toLocaleString()}`}
            icon={<ArrowUpRight className="h-3.5 w-3.5 text-primary" />}
          />
        </div>

        {/* Factors */}
        {prediction.factors.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-foreground mb-1.5">Fatores de Impacto</p>
            <div className="space-y-1">
              {prediction.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{f.factor}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={
                      f.impact === 'positive' ? 'text-success' :
                      f.impact === 'negative' ? 'text-destructive' :
                      'text-muted-foreground'
                    }>
                      {f.impact === 'positive' ? '↑' : f.impact === 'negative' ? '↓' : '→'}
                    </span>
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          f.impact === 'positive' ? 'bg-success' :
                          f.impact === 'negative' ? 'bg-destructive' :
                          'bg-muted-foreground'
                        }`}
                        style={{ width: `${f.weight * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBox({
  label,
  value,
  subValue,
  icon,
  accent,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  accent?: 'success' | 'destructive';
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-bold ${
        accent === 'success' ? 'text-success' :
        accent === 'destructive' ? 'text-destructive' :
        'text-foreground'
      }`}>
        {value}
      </p>
      {subValue && (
        <p className={`text-[10px] ${
          accent === 'success' ? 'text-success' :
          accent === 'destructive' ? 'text-destructive' :
          'text-muted-foreground'
        }`}>
          {subValue}
        </p>
      )}
    </div>
  );
}
