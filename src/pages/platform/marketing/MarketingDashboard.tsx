/**
 * /platform/marketing/dashboard — Marketing Digital OS Dashboard
 *
 * Widgets:
 *  <UnifiedConversionFunnel />  — 7-stage pipeline summary
 *  <TopLandingLeaderboard />    — Landing pages ranked by conversion
 *  <WebsiteSEOScore />          — Website SEO health overview
 *  <AIOptimizationFeed />       — AI suggestions feed
 */
import { useState, useEffect } from 'react';
import {
  BarChart3, Trophy, Search, Brain, TrendingUp, ArrowDown,
  Eye, MousePointerClick, UserPlus, Building2, CreditCard, DollarSign, Zap,
  Sparkles, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  marketingAnalyticsAggregator,
  type MarketingKPIs,
  type AssetPerformance,
} from '@/domains/marketing-digital-os';
import { conversionPipeline, type ConversionPipelineSnapshot } from '@/domains/marketing-digital-os';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import { landingPageBuilder } from '@/domains/platform-growth';
import type { LandingPage } from '@/domains/platform-growth/types';

export default function MarketingDashboard() {
  const [kpis, setKpis] = useState<MarketingKPIs | null>(null);
  const [assets, setAssets] = useState<AssetPerformance[]>([]);
  const [snapshots, setSnapshots] = useState<ConversionPipelineSnapshot[]>([]);
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      marketingAnalyticsAggregator.getKPIs(),
      marketingAnalyticsAggregator.getAssetPerformance(),
      conversionPipeline.getAllSnapshots(),
      landingPageBuilder.getAll(),
    ]).then(([k, a, s, p]) => {
      setKpis(k);
      setAssets(a);
      setSnapshots(s);
      setPages(p);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <DashboardHero />
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando dashboard…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHero />

      {/* KPI summary row */}
      {kpis && <KPIRow kpis={kpis} />}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UnifiedConversionFunnel snapshots={snapshots} />
        <TopLandingLeaderboard assets={assets} />
        <WebsiteSEOScore pages={pages} />
        <AIOptimizationFeed pages={pages} />
      </div>
    </div>
  );
}

function DashboardHero() {
  return (
    <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Marketing Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão unificada: Website + Landing Pages + Pipeline + IA.
          </p>
        </div>
      </div>
    </div>
  );
}

function KPIRow({ kpis }: { kpis: MarketingKPIs }) {
  const items = [
    { label: 'Views', value: kpis.totalViews.toLocaleString(), icon: Eye },
    { label: 'Conversões', value: kpis.totalConversions.toLocaleString(), icon: TrendingUp },
    { label: 'Taxa Média', value: `${kpis.avgConversionRate}%`, icon: BarChart3 },
    { label: 'Receita', value: `R$ ${kpis.totalRevenue.toLocaleString()}`, icon: DollarSign },
    { label: 'Bounce', value: `${kpis.avgBounceRate}%`, icon: AlertTriangle },
    { label: 'AI Score', value: `${kpis.avgAIScore}/100`, icon: Brain },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(item => (
        <Card key={item.label} className="border-border/60 bg-card/60">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <item.icon className="h-4 w-4 text-primary" />
            <span className="text-lg font-bold text-foreground">{item.value}</span>
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Widget 1: Unified Conversion Funnel ────────────────

const STAGE_ICONS = [Zap, Eye, MousePointerClick, UserPlus, Building2, CreditCard, DollarSign];
const STAGE_COLORS = ['bg-blue-500', 'bg-sky-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-teal-500', 'bg-amber-500', 'bg-green-600'];

function UnifiedConversionFunnel({ snapshots }: { snapshots: ConversionPipelineSnapshot[] }) {
  // Aggregate stages across all snapshots
  const aggregated = snapshots.length > 0
    ? snapshots[0].stages.map((_, i) => ({
        stage: snapshots[0].stages[i].stage,
        volume: snapshots.reduce((s, snap) => s + snap.stages[i].volume, 0),
      }))
    : [];

  const maxVol = Math.max(...aggregated.map(s => s.volume), 1);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Funil de Conversão Unificado
        </CardTitle>
      </CardHeader>
      <CardContent>
        {aggregated.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-6">Sem dados de pipeline.</p>
        ) : (
          <div className="space-y-0">
            {aggregated.map((s, i) => {
              const Icon = STAGE_ICONS[i] ?? Zap;
              const color = STAGE_COLORS[i] ?? STAGE_COLORS[0];
              const widthPct = Math.max((s.volume / maxVol) * 100, 8);
              return (
                <div key={s.stage}>
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex items-center gap-1.5 w-24 shrink-0 justify-end">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] font-medium text-muted-foreground text-right">{s.stage}</span>
                    </div>
                    <div className="flex-1">
                      <div
                        className={`${color} h-5 rounded transition-all duration-500 flex items-center justify-end pr-1.5`}
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className="text-[8px] font-bold text-white">{s.volume.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  {i < aggregated.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowDown className="h-3 w-3 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 2: Top Landing Leaderboard ──────────────────

function TopLandingLeaderboard({ assets }: { assets: AssetPerformance[] }) {
  const top5 = assets.slice(0, 5);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Top Landing Pages
        </CardTitle>
      </CardHeader>
      <CardContent>
        {top5.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-6">Nenhuma landing page.</p>
        ) : (
          <div className="space-y-3">
            {top5.map((asset, i) => (
              <div key={asset.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">{asset.views.toLocaleString()} views</span>
                    <span className="text-[9px] text-muted-foreground">•</span>
                    <span className="text-[9px] text-muted-foreground">{asset.conversions} conv.</span>
                  </div>
                </div>
                <Badge variant={asset.conversionRate > 5 ? 'secondary' : 'outline'} className="text-[9px]">
                  {asset.conversionRate}%
                </Badge>
                <Badge
                  variant={asset.riskLevel === 'low' ? 'secondary' : asset.riskLevel === 'medium' ? 'outline' : 'destructive'}
                  className="text-[9px]"
                >
                  {asset.aiScore}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 3: Website SEO Score ─────────────────────────

function WebsiteSEOScore({ pages }: { pages: LandingPage[] }) {
  // Derive SEO metrics from page analytics
  const avgBounce = pages.length > 0
    ? Math.round(pages.reduce((s, p) => s + p.analytics.bounceRate, 0) / pages.length)
    : 0;
  const avgTime = pages.length > 0
    ? Math.round(pages.reduce((s, p) => s + p.analytics.avgTimeOnPage, 0) / pages.length)
    : 0;
  const seoScore = Math.max(0, Math.min(100, 100 - avgBounce + Math.min(avgTime / 3, 20)));

  const metrics = [
    { label: 'SEO Score', value: Math.round(seoScore), max: 100 },
    { label: 'Bounce Rate', value: avgBounce, max: 100, invert: true },
    { label: 'Tempo Médio', value: avgTime, max: 300, suffix: 's' },
  ];

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          Website SEO Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main score */}
        <div className="flex items-center justify-center">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-muted/20" />
              <circle
                cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                className="stroke-primary"
                strokeDasharray={`${(seoScore / 100) * 251.2} 251.2`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-xl font-bold text-foreground">{Math.round(seoScore)}</span>
          </div>
        </div>

        {metrics.map(m => (
          <div key={m.label} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-medium text-foreground">{m.value}{m.suffix ?? ''}</span>
            </div>
            <Progress
              value={m.invert ? 100 - (m.value / m.max) * 100 : (m.value / m.max) * 100}
              className="h-1.5"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Widget 4: AI Optimization Feed ─────────────────────

function AIOptimizationFeed({ pages }: { pages: LandingPage[] }) {
  const suggestions = pages.slice(0, 3).flatMap(page => {
    const heroBlock = page.blocks?.find(b => b.type === 'hero');
    const currentHeadline = heroBlock ? String((heroBlock.content as Record<string, unknown>)?.title ?? '') : page.name;
    const headlines = growthAISupportLayer.suggestHeadline(currentHeadline);
    const risk = growthAISupportLayer.analyzeConversionRisk(page);
    const items: Array<{ type: string; page: string; text: string; impact: string }> = [];

    if (headlines.length > 0) {
      items.push({
        type: 'headline',
        page: page.name,
        text: `"${headlines[0].variant}" — lift esperado: ${headlines[0].expectedLiftPct}%`,
        impact: `${headlines[0].confidence}% confiança`,
      });
    }

    if (risk.riskLevel !== 'low') {
      items.push({
        type: 'risk',
        page: page.name,
        text: risk.recommendation,
        impact: `Score: ${risk.overallScore}/100`,
      });
    }

    return items;
  });

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Feed de Otimização IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-6">Nenhuma sugestão no momento.</p>
        ) : (
          <div className="space-y-3">
            {suggestions.slice(0, 6).map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/40">
                {s.type === 'headline'
                  ? <Brain className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-foreground">{s.page}</p>
                  <p className="text-[10px] text-muted-foreground">{s.text}</p>
                </div>
                <Badge variant="outline" className="text-[8px] shrink-0">{s.impact}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
