/**
 * PredictiveRiskAnalysis — Historical trends + AI-powered risk forecasting.
 *
 * Features:
 * - Risk trend chart (recharts)
 * - AI forecast with contributing factors
 * - Trend indicators and velocity
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Brain, TrendingUp, TrendingDown, Minus, Activity,
  Loader2, Sparkles, BarChart3, AlertTriangle, Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import {
  captureRiskTrendSnapshot,
  analyzeTrends,
  requestAIForecast,
} from '@/domains/governance';
import type { RiskTrendAnalysis, RiskForecast } from '@/domains/governance';

interface Props {
  tenantId: string;
  className?: string;
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

const RISK_BG: Record<string, string> = {
  low: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const TREND_ICONS = {
  improving: TrendingDown,
  stable: Minus,
  degrading: TrendingUp,
  unknown: Activity,
};

export function PredictiveRiskAnalysis({ tenantId, className }: Props) {
  const [forecast, setForecast] = useState<RiskForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const { data: trendAnalysis, isLoading, refetch } = useQuery({
    queryKey: ['risk-trends', tenantId],
    queryFn: () => analyzeTrends(tenantId, 30),
  });

  const captureMutation = useMutation({
    mutationFn: () => captureRiskTrendSnapshot(tenantId),
    onSuccess: () => {
      refetch();
      toast.success('Snapshot de risco capturado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleForecast = async () => {
    if (!trendAnalysis) return;
    setForecastLoading(true);
    try {
      const result = await requestAIForecast(tenantId, trendAnalysis);
      setForecast(result);
      if (!result) toast.error('Não foi possível gerar previsão.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na previsão.');
    } finally {
      setForecastLoading(false);
    }
  };

  const snapshots = trendAnalysis?.snapshots ?? [];
  const trend = trendAnalysis?.trend;
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const TrendIcon = TREND_ICONS[trend?.trend ?? 'unknown'];

  const chartData = snapshots.map(s => ({
    date: new Date(s.snapshot_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: s.risk_score,
    signals: s.signal_count,
    critical: s.critical_count,
    high_risk_users: s.high_risk_users,
  }));

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Análise Preditiva de Risco</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => captureMutation.mutate()}
            disabled={captureMutation.isPending}
          >
            {captureMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
            Capturar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleForecast}
            disabled={forecastLoading || snapshots.length < 2}
          >
            {forecastLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Prever Risco
          </Button>
        </div>
      </div>

      {/* Current State + Trend */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Score Atual</p>
              <p className={`text-2xl font-bold ${RISK_COLORS[latest.risk_level]}`}>
                {latest.risk_score}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3 flex items-center gap-2">
              <TrendIcon className={`h-5 w-5 ${
                trend?.trend === 'improving' ? 'text-green-400' :
                trend?.trend === 'degrading' ? 'text-red-400' : 'text-muted-foreground'
              }`} />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Tendência</p>
                <p className="text-sm font-medium capitalize">{trend?.trend ?? 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Velocidade</p>
              <p className="text-sm font-medium">
                {trend?.velocity !== undefined ? `${trend.velocity > 0 ? '+' : ''}${trend.velocity}/dia` : 'N/A'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Usuários Alto Risco</p>
              <p className="text-2xl font-bold text-amber-400">{latest.high_risk_users}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolução do Risco</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <ReferenceLine y={70} stroke="hsl(0, 80%, 50%)" strokeDasharray="3 3" label={{ value: 'Crítico', fontSize: 9 }} />
                <ReferenceLine y={45} stroke="hsl(30, 80%, 50%)" strokeDasharray="3 3" label={{ value: 'Alto', fontSize: 9 }} />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#riskGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI Forecast */}
      {forecast && (
        <Card className="border-border/50 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Previsão AI — {forecast.horizon_days} dias
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Confiança: {Math.round(forecast.confidence * 100)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Score comparison */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Atual</p>
                <Badge variant="outline" className={RISK_BG[forecast.current_level]}>
                  {forecast.current_score} ({forecast.current_level})
                </Badge>
              </div>
              <span className="text-muted-foreground">→</span>
              <div>
                <p className="text-[10px] text-muted-foreground">Previsto</p>
                <Badge variant="outline" className={RISK_BG[forecast.predicted_level]}>
                  {forecast.predicted_score} ({forecast.predicted_level})
                </Badge>
              </div>
            </div>

            {/* Contributing factors */}
            {forecast.contributing_factors?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Fatores Contribuintes:</p>
                <div className="space-y-1">
                  {forecast.contributing_factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      {f.impact === 'negative'
                        ? <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                        : <Eye className="h-3 w-3 text-green-400 shrink-0" />}
                      <span className="flex-1">{f.factor}</span>
                      <Progress value={f.weight * 100} className="w-16 h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {forecast.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Recomendações:</p>
                <ul className="space-y-0.5">
                  {forecast.recommendations.map((r, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground">💡 {r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Narrative */}
            <p className="text-[11px] text-muted-foreground border-l-2 border-primary/30 pl-2 py-1">
              {forecast.ai_narrative}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && snapshots.length === 0 && (
        <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
          <Brain className="h-10 w-10 mx-auto opacity-20" />
          <p>Nenhum dado de tendência disponível.</p>
          <p className="text-[10px]">Capture snapshots periodicamente para análise preditiva.</p>
        </div>
      )}
    </div>
  );
}
