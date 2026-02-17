/**
 * /platform/marketing/insights — Marketing Intelligence Dashboard
 *
 * Shows:
 *  - Top Landing Pages
 *  - Website Performance
 *  - Headlines com maior conversão
 *  - FAB Score médio
 *
 * Widgets: GrowthHeatmap, ConversionOpportunities, AIRecommendationsFeed
 */
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Globe, TrendingUp, Sparkles, Target,
  Crown, Brain, HelpCircle, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { landingPageBuilder, fabContentEngine, seoOptimizationService } from '@/domains/platform-growth';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import type { LandingPage } from '@/domains/platform-growth/types';
import GrowthHeatmap from '@/components/platform/marketing/GrowthHeatmap';
import ConversionOpportunities from '@/components/platform/marketing/ConversionOpportunities';
import AIRecommendationsFeed from '@/components/platform/marketing/AIRecommendationsFeed';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';

export default function MarketingInsights() {
  const { can } = usePlatformPermissions();
  const hasAccess = can('growth_insights.view');
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => { landingPageBuilder.getAll().then(setPages); }, []);

  // ── Derived metrics (hooks must be before any early return) ──
  const topPages = useMemo(
    () => [...pages].sort((a, b) => b.analytics.conversionRate - a.analytics.conversionRate).slice(0, 5),
    [pages],
  );

  const avgFABScore = useMemo(() => {
    if (pages.length === 0) return 0;
    const scores = pages.map(p => {
      const fab = growthAISupportLayer.suggestFABStructure(p);
      return 3 - fab.missingElements.length;
    });
    return Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 33.3);
  }, [pages]);

  const bestHeadlines = useMemo(() => {
    const all = pages.flatMap(p => {
      const headline = (p.blocks?.[0]?.content?.headline as string) ?? p.name;
      const suggestions = growthAISupportLayer.suggestHeadline(headline, { pageType: 'landing' });
      return suggestions.map(s => ({ ...s, pageName: p.name }));
    });
    return all.sort((a, b) => b.expectedLiftPct - a.expectedLiftPct).slice(0, 4);
  }, [pages]);

  const websiteScore = useMemo(() => {
    if (pages.length === 0) return 0;
    const avgConversion = pages.reduce((s, p) => s + p.analytics.conversionRate, 0) / pages.length;
    return Math.min(100, Math.round(avgConversion * 12 + avgFABScore * 0.3));
  }, [pages, avgFABScore]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Sem permissão para acessar Insights de Crescimento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Insights de Crescimento</h1>
              <p className="text-sm text-muted-foreground">
                Inteligência de marketing: top LPs, headlines, FAB e oportunidades de conversão.
              </p>
            </div>
          </div>
          <button onClick={() => setShowHelp(p => !p)} className="p-1.5 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showHelp && (
        <Card className="border-primary/20 bg-primary/5 animate-fade-in">
          <CardContent className="p-5 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-accent/40 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm text-muted-foreground">
              Painel de inteligência que cruza dados de landing pages, website e experimentos A/B para
              identificar oportunidades de crescimento e recomendar ações concretas via AI.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Landing Pages', value: pages.length, icon: Globe, color: 'hsl(265 80% 55%)' },
          { label: 'Website Score', value: `${websiteScore}/100`, icon: TrendingUp, color: 'hsl(145 60% 42%)' },
          { label: 'Melhor Conversão', value: topPages[0] ? `${topPages[0].analytics.conversionRate}%` : '—', icon: Crown, color: 'hsl(30 90% 55%)' },
          { label: 'FAB Score Médio', value: `${avgFABScore}/100`, icon: Target, color: 'hsl(200 70% 50%)' },
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

      {/* Top Landing Pages + Headlines */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top LPs */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              Top Landing Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topPages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma LP cadastrada.</p>
            ) : (
              topPages.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={p.analytics.conversionRate * 10} className="h-1 flex-1" />
                      <span className="text-[10px] text-muted-foreground">{p.analytics.views} views</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground">{p.analytics.conversionRate}%</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Best Headlines */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Headlines com Maior Conversão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bestHeadlines.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">Sem dados disponíveis.</p>
            ) : (
              bestHeadlines.map((h, i) => (
                <div key={h.id} className="p-2 rounded-lg bg-muted/20 space-y-1">
                  <p className="text-[10px] text-muted-foreground truncate">Página: {h.pageName}</p>
                  <p className="text-xs font-medium text-foreground line-clamp-1">{h.variant}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[9px]">+{h.expectedLiftPct}% lift</Badge>
                    <span className="text-[10px] text-muted-foreground">{h.confidence}% confiança</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Widgets Row */}
      <div className="grid md:grid-cols-2 gap-4">
        <GrowthHeatmap />
        <ConversionOpportunities />
      </div>

      {/* AI Feed — full width */}
      <AIRecommendationsFeed />
    </div>
  );
}
