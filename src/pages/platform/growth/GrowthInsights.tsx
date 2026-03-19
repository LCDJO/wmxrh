/**
 * GrowthInsights — AI-powered growth strategies and plan optimization.
 */
import { useState, useMemo, useEffect } from 'react';
import {
  Brain, TrendingUp, Target, Zap, Users, ArrowUpRight,
  HelpCircle, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { planOptimizationAdvisor } from '@/domains/platform-growth';
import { useGrowthInsights } from '@/hooks/platform/use-growth-insights';
import type { PlanOptimizationSuggestion } from '@/domains/platform-growth/types';

const IMPACT_COLORS: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const TYPE_ICONS: Record<string, typeof Brain> = {
  acquisition: Users,
  retention: Target,
  expansion: TrendingUp,
  reactivation: Zap,
};

export default function GrowthInsights() {
  const [showHelp, setShowHelp] = useState(false);
  const { insights, metrics, loading, error } = useGrowthInsights();
  const [suggestions, setSuggestions] = useState<PlanOptimizationSuggestion[]>([]);

  useEffect(() => {
    planOptimizationAdvisor.getSuggestions().then(setSuggestions);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Growth Insights</h1>
              <p className="text-sm text-muted-foreground">Estratégias de crescimento e otimização de planos com IA.</p>
            </div>
          </div>
          <button onClick={() => setShowHelp(p => !p)} className="p-1.5 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showHelp && (
        <Card className="border-[hsl(265_60%_50%/0.25)] bg-[hsl(265_60%_50%/0.04)] animate-fade-in">
          <CardContent className="p-5 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-accent/40 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm text-muted-foreground">Insights gerados pela IA analisam métricas de aquisição, retenção, expansão e reativação para recomendar ações concretas de crescimento.</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'MRR Total', value: loading ? '...' : `R$ ${metrics.totalMRR.toLocaleString()}`, icon: TrendingUp, color: 'hsl(145 60% 42%)' },
          { label: 'Tenants Pagantes', value: loading ? '...' : metrics.payingTenants, icon: Users, color: 'hsl(265 80% 55%)' },
          { label: 'MRR em Risco', value: loading ? '...' : `R$ ${metrics.mrrAtRisk.toLocaleString()}`, icon: Target, color: 'hsl(30 90% 55%)' },
          { label: 'Upgrade Candidates', value: loading ? '...' : metrics.upgradeCandidates, icon: ArrowUpRight, color: 'hsl(200 70% 50%)' },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-border/60 bg-card/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${kpi.color}18` }}>
                  <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 text-xs text-red-400">Erro: {error}</CardContent>
        </Card>
      )}

      {/* Plan Optimization */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Otimização de Planos</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {suggestions.map(s => (
              <Card key={s.id} className="border-border/60 bg-card/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">Plan Optimization</Badge>
                    <span className="text-xs text-muted-foreground">{s.confidence}%</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{s.tenantName}: {s.currentPlan} → {s.suggestedPlan}</p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <ArrowUpRight className="h-3 w-3" />+R$ {s.expectedRevenueImpact}/mês
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Insights de IA</h2>
        {insights.map(insight => {
          const TypeIcon = TYPE_ICONS[insight.type] ?? Brain;
          return (
            <Card key={insight.id} className="border-border/60 bg-card/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="h-4 w-4 text-[hsl(265_80%_60%)]" />
                    <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] border', IMPACT_COLORS[insight.impact])}>
                    {insight.impact}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {insight.suggestedActions.map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] font-normal">{a}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
