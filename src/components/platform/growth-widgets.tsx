/**
 * Growth Dashboard Widgets — LandingConversionRate, RevenueByLandingPage, FABPerformanceInsights
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe, DollarSign, Sparkles, TrendingUp, Target, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { landingPageBuilder, conversionTrackingService, fabContentEngine } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';

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
