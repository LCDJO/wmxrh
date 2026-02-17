/**
 * Growth Dashboard Widgets — LandingConversionRate, RevenueByLandingPage, FABPerformanceInsights, GrowthAIInsights
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe, DollarSign, Sparkles, TrendingUp, Target, Eye, Brain, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { landingPageBuilder, conversionTrackingService, fabContentEngine, growthGovernanceAnalyzer } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';
import type { GrowthGovernanceFinding } from '@/domains/platform-growth/growth-governance-analyzer';

/* ── Landing Conversion Rate ── */
export function LandingConversionRate() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  useEffect(() => { landingPageBuilder.getAll().then(setPages); }, []);

  const avgRate = pages.length > 0
    ? (pages.reduce((s, p) => s + p.analytics.conversionRate, 0) / pages.length).toFixed(1)
    : '0';

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Conversion Rate (LPs)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold font-display text-foreground">{avgRate}%</p>
        <p className="text-xs text-muted-foreground">{pages.length} landing pages ativas</p>
        {pages.slice(0, 4).map(p => (
          <div key={p.id} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate max-w-[140px]">{p.name}</span>
            <div className="flex items-center gap-2">
              <Progress value={p.analytics.conversionRate} className="h-1.5 w-16" />
              <span className="font-semibold text-foreground w-10 text-right">{p.analytics.conversionRate}%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Revenue by Landing Page ── */
export function RevenueByLandingPage() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  useEffect(() => { landingPageBuilder.getAll().then(setPages); }, []);

  const revenueData = useMemo(() =>
    pages.map(p => {
      const funnel = conversionTrackingService.getConversionFunnel(p.id);
      return { name: p.name, revenue: funnel.totalRevenue, conversions: funnel.revenueEvents, views: p.analytics.views };
    }).sort((a, b) => b.revenue - a.revenue),
  [pages]);

  const totalRevenue = revenueData.reduce((s, d) => s + d.revenue, 0);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-500" /> Receita por LP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold font-display text-foreground">
          R$ {totalRevenue.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">{revenueData.length} páginas com tracking</p>
        {revenueData.slice(0, 4).map(d => {
          const pct = totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 100) : 0;
          return (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate max-w-[120px]">{d.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[9px]">{d.conversions} conv</Badge>
                <span className="font-semibold text-emerald-400 w-16 text-right">R$ {d.revenue}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ── FAB Performance Insights ── */
export function FABPerformanceInsights() {
  const blueprint = useMemo(() => fabContentEngine.generateBlueprint('tech', []), []);

  const sectionItems = useMemo(() => [
    { type: 'hero', fab: blueprint.hero.fab },
    ...blueprint.features.map((f, i) => ({ type: `feature-${i + 1}`, fab: f })),
    ...blueprint.advantages.map((a, i) => ({ type: `advantage-${i + 1}`, fab: a.fab })),
  ], [blueprint]);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> FAB Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold font-display text-foreground">{sectionItems.length} blocos</p>
        <p className="text-xs text-muted-foreground">Blueprint gerado para indústria tech</p>
        {sectionItems.slice(0, 4).map((section, i) => (
          <div key={i} className="p-2 rounded-md bg-muted/20 border border-border/40 space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[9px] capitalize">{section.type}</Badge>
              <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
            </div>
            {section.fab && (
              <p className="text-[10px] text-muted-foreground truncate">
                F: {section.fab.feature} → B: {section.fab.benefit}
              </p>
            )}
          </div>
        ))}
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center gap-2 text-xs">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span className="text-foreground font-medium truncate">{blueprint.hero.headline}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── GrowthAI Insights ── */
const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-destructive', badge: 'destructive' as const, bg: 'bg-destructive/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', badge: 'outline' as const, bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-muted-foreground', badge: 'secondary' as const, bg: 'bg-muted/20' },
};

export function GrowthAIInsights() {
  const [findings, setFindings] = useState<GrowthGovernanceFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    growthGovernanceAnalyzer.analyze().then(f => {
      setFindings(f);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;

  return (
    <Card className="border-border/60 bg-card/60 col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> GrowthAI Insights
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-[9px] ml-auto">{criticalCount} crítico{criticalCount > 1 ? 's' : ''}</Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">{warningCount} aviso{warningCount > 1 ? 's' : ''}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Analisando landing pages...</p>
        ) : findings.length === 0 ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Nenhum problema detectado — todas as LPs estão saudáveis.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {findings.slice(0, 6).map(f => {
              const config = SEVERITY_CONFIG[f.severity];
              const Icon = config.icon;
              return (
                <div key={f.id} className={cn('p-3 rounded-lg border border-border/40 space-y-1.5', config.bg)}>
                  <div className="flex items-start gap-2">
                    <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', config.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight">{f.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{f.description}</p>
                    </div>
                    <Badge variant={config.badge} className="text-[9px] shrink-0">{f.category.replace('_', ' ')}</Badge>
                  </div>
                  {f.suggestedActions.length > 0 && (
                    <p className="text-[10px] text-primary pl-5 truncate">→ {f.suggestedActions[0]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {findings.length > 6 && (
          <p className="text-[10px] text-muted-foreground text-center">+{findings.length - 6} insight(s) adicionais</p>
        )}
      </CardContent>
    </Card>
  );
}
