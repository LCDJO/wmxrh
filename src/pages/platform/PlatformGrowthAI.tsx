/**
 * PlatformGrowthAI — Dashboard for Growth AI + Landing Page Builder.
 */
import { useState, useMemo } from 'react';
import {
  Rocket, Brain, TrendingUp, Layout, Tag, Target, BarChart3,
  ChevronRight, Zap, Globe, Eye, Users, DollarSign, Percent,
  ArrowUpRight, Sparkles, Code, ExternalLink, HelpCircle, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { planOptimizationAdvisor } from '@/domains/platform-growth';
import { conversionPredictionService } from '@/domains/platform-growth';
import { landingPageBuilder } from '@/domains/platform-growth';
import { tagManagerIntegration } from '@/domains/platform-growth';
import { conversionTrackingService } from '@/domains/platform-growth';
import { useGrowthInsights } from '@/hooks/use-growth-insights';

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

export default function PlatformGrowthAI() {
  const [showHelp, setShowHelp] = useState(false);

  const { insights, metrics: growthMetrics, loading, error, refresh } = useGrowthInsights();
  const planSuggestions = useMemo(() => planOptimizationAdvisor.getSuggestions(), []);
  const predictions = useMemo(() => conversionPredictionService.getBatchPredictions(), []);
  const pages = useMemo(() => landingPageBuilder.getAll(), []);
  const funnel = useMemo(() => conversionTrackingService.getConversionFunnel('lp-1'), []);

  const architectureNodes = [
    { id: 'GrowthInsightEngine', icon: Brain, color: 'hsl(265 80% 55%)', desc: 'Estratégias de crescimento com IA' },
    { id: 'PlanOptimizationAdvisor', icon: TrendingUp, color: 'hsl(200 70% 50%)', desc: 'Recomendações de upgrade de planos' },
    { id: 'ConversionPredictionService', icon: Target, color: 'hsl(145 60% 42%)', desc: 'Scoring de leads e predição' },
    { id: 'LandingPageBuilder', icon: Layout, color: 'hsl(30 90% 55%)', desc: 'CRUD e gestão de landing pages' },
    { id: 'FABContentEngine', icon: Sparkles, color: 'hsl(320 70% 55%)', desc: 'Geração de copy FAB (Features-Advantages-Benefits)' },
    { id: 'TagManagerIntegration', icon: Tag, color: 'hsl(50 80% 50%)', desc: 'Bridge com Google Tag Manager' },
    { id: 'ConversionTrackingService', icon: BarChart3, color: 'hsl(0 70% 55%)', desc: 'Tracking de eventos e funil de conversão' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(265 80% 55%), transparent 70%)' }} />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, hsl(30 90% 55%), transparent 70%)' }} />

        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Growth AI + Landing Pages
                </h1>
                <p className="text-sm text-muted-foreground">
                  Estratégias de crescimento, landing pages de alta conversão e tracking integrado.
                </p>
              </div>
              <button onClick={() => setShowHelp(p => !p)} className="ml-2 p-1.5 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Help ── */}
      {showHelp && (
        <Card className="border-[hsl(265_60%_50%/0.25)] bg-[hsl(265_60%_50%/0.04)] animate-fade-in">
          <CardContent className="p-5 space-y-4 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-[hsl(265_80%_60%)]" />
              O que é o Growth AI?
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🚀 Função</p>
                <p>Camada de <strong className="text-foreground">inteligência para aquisição e retenção</strong> de tenants. Sugere estratégias, cria landing pages e conecta tudo ao sistema financeiro.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔗 Integrações</p>
                <p>Conecta com <strong className="text-foreground">Revenue Intelligence, Referral Engine, Gamification, Billing Core</strong> e Observability para um ciclo completo de growth.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📊 Tracking</p>
                <p>Google Tag Manager nativo, <strong className="text-foreground">funil de conversão</strong> em tempo real e predição de conversão por lead source.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Architecture ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Code className="h-4 w-4 text-[hsl(265_80%_60%)]" />
            Arquitetura do Módulo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {architectureNodes.map(node => {
              const Icon = node.icon;
              return (
                <div key={node.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-[hsl(265_60%_50%/0.3)] transition-colors">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md shrink-0" style={{ background: `${node.color}22` }}>
                    <Icon className="h-4 w-4" style={{ color: node.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{node.id}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{node.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards (real data) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'MRR Total', value: `R$ ${growthMetrics.totalMRR.toLocaleString()}`, icon: DollarSign, color: 'hsl(145 60% 42%)' },
          { label: 'Tenants Pagantes', value: growthMetrics.payingTenants, icon: Users, color: 'hsl(265 80% 55%)' },
          { label: 'Churn Rate', value: `${growthMetrics.churnRate}%`, icon: TrendingUp, color: 'hsl(0 70% 55%)' },
          { label: 'MRR em Risco', value: `R$ ${growthMetrics.mrrAtRisk.toLocaleString()}`, icon: Target, color: 'hsl(30 90% 55%)' },
          { label: 'Upgrade Candidates', value: growthMetrics.upgradeCandidates, icon: ArrowUpRight, color: 'hsl(200 70% 50%)' },
          { label: 'Referral Conv.', value: `${growthMetrics.referralConversionRate}%`, icon: Zap, color: 'hsl(50 80% 50%)' },
          { label: 'Melhor Plano', value: growthMetrics.bestPlan, icon: Sparkles, color: 'hsl(320 70% 55%)' },
          { label: 'Melhor Módulo', value: growthMetrics.bestModule, icon: Brain, color: 'hsl(265 60% 50%)' },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${kpi.color}18` }}>
                  <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{loading ? '...' : kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 text-xs text-red-400">
            Erro ao carregar insights: {error}
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="insights" className="gap-1.5"><Brain className="h-3.5 w-3.5" />Insights</TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5"><Layout className="h-3.5 w-3.5" />Landing Pages</TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Funil</TabsTrigger>
          <TabsTrigger value="predictions" className="gap-1.5"><Target className="h-3.5 w-3.5" />Predições</TabsTrigger>
          <TabsTrigger value="gtm" className="gap-1.5"><Tag className="h-3.5 w-3.5" />GTM</TabsTrigger>
        </TabsList>

        {/* ── Insights Tab ── */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            {planSuggestions.map(s => (
              <Card key={s.id} className="border-border/60 bg-card/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">Plan Optimization</Badge>
                    <span className="text-xs text-muted-foreground">{s.confidence}% confiança</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{s.tenantName}: {s.currentPlan} → {s.suggestedPlan}</p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <ArrowUpRight className="h-3 w-3" />
                    +R$ {s.expectedRevenueImpact}/mês
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3">
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
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cn('text-[10px] border', IMPACT_COLORS[insight.impact])}>
                          {insight.impact}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{insight.confidence}%</span>
                      </div>
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
        </TabsContent>

        {/* ── Landing Pages Tab ── */}
        <TabsContent value="pages" className="space-y-4">
          {pages.map(page => (
            <Card key={page.id} className="border-border/60 bg-card/60">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[hsl(30_90%_55%/0.12)]">
                      <Globe className="h-5 w-5 text-[hsl(30_90%_55%)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{page.title}</h3>
                      <p className="text-xs text-muted-foreground">/{page.slug} • {page.blocks.length} blocos</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px]', page.status === 'published' ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400')}>
                    {page.status}
                  </Badge>
                </div>

                {/* Analytics summary */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Views', value: page.analytics.views.toLocaleString(), icon: Eye },
                    { label: 'Únicos', value: page.analytics.uniqueVisitors.toLocaleString(), icon: Users },
                    { label: 'Conversões', value: page.analytics.conversions, icon: Target },
                    { label: 'Conv. Rate', value: `${page.analytics.conversionRate}%`, icon: Percent },
                    { label: 'Tempo médio', value: `${Math.round(page.analytics.avgTimeOnPage / 60)}min`, icon: BarChart3 },
                    { label: 'Bounce', value: `${page.analytics.bounceRate}%`, icon: ArrowUpRight },
                  ].map(stat => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="text-center p-2 rounded-md bg-muted/20 border border-border/40">
                        <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-bold text-foreground">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Blocks */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Blocos FAB:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {page.blocks.map(block => (
                      <Badge key={block.id} variant="secondary" className="text-[10px] gap-1">
                        <Layout className="h-2.5 w-2.5" />
                        {block.type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Sources */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Top Sources:</p>
                  <div className="flex gap-3">
                    {page.analytics.topSources.map(s => (
                      <div key={s.source} className="flex items-center gap-1.5 text-xs">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground font-medium">{s.source}</span>
                        <span className="text-muted-foreground">({s.visits})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Funnel Tab ── */}
        <TabsContent value="funnel" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Page Views', value: funnel.views, color: 'hsl(265 80% 55%)' },
                { label: 'Signups', value: funnel.signups, color: 'hsl(200 70% 50%)' },
                { label: 'Trials', value: funnel.trials, color: 'hsl(145 60% 42%)' },
                { label: 'Purchases', value: funnel.purchases, color: 'hsl(30 90% 55%)' },
              ].map((step, idx) => {
                const width = Math.max(8, (step.value / funnel.views) * 100);
                return (
                  <div key={step.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{step.label}</span>
                      <span className="font-semibold text-foreground">{step.value.toLocaleString()}</span>
                    </div>
                    <div className="h-6 rounded-md bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-700 flex items-center justify-end pr-2"
                        style={{ width: `${width}%`, background: step.color }}
                      >
                        {width > 15 && <span className="text-[10px] font-bold text-white">{width.toFixed(1)}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Receita total de conversões</span>
                <span className="text-lg font-bold text-emerald-400">R$ {funnel.totalRevenue.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Conversion events list */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Eventos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {conversionTrackingService.getAll().map(evt => (
                  <div key={evt.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/20 border border-border/40">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{evt.type}</Badge>
                      <span className="text-xs text-muted-foreground">{evt.source}</span>
                      {evt.referralCode && (
                        <Badge variant="secondary" className="text-[10px]">🔗 {evt.referralCode}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {evt.revenue && <span className="text-xs font-semibold text-emerald-400">R$ {evt.revenue}</span>}
                      <span className="text-[10px] text-muted-foreground">{new Date(evt.trackedAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Predictions Tab ── */}
        <TabsContent value="predictions" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {predictions.map(pred => (
              <Card key={pred.leadId} className="border-border/60 bg-card/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] capitalize">{pred.source.replace('_', ' ')}</Badge>
                    <div className={cn(
                      'flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold',
                      pred.score >= 70 ? 'bg-emerald-500/15 text-emerald-400' :
                      pred.score >= 50 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    )}>
                      {pred.score}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Plano previsto: <strong className="text-foreground">{pred.predictedPlan}</strong></p>
                    <p className="text-xs text-muted-foreground">MRR estimado: <strong className="text-emerald-400">R$ {pred.predictedMRR}</strong></p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pred.topFactors.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px] font-normal">{f}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── GTM Tab ── */}
        <TabsContent value="gtm" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-[hsl(50_80%_50%)]" />
                Google Tag Manager
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs font-medium text-foreground mb-1">Container ID</p>
                <code className="text-xs text-muted-foreground font-mono">GTM-XXXXXX</code>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Eventos configurados:</p>
                <div className="space-y-1.5">
                  {tagManagerIntegration.configure('lp-1', 'GTM-XXXXXX').events.map(evt => (
                    <div key={evt.name} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/40">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{evt.category}</Badge>
                        <span className="text-xs font-medium text-foreground">{evt.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">trigger: {evt.trigger}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Snippet de instalação:</p>
                <pre className="p-3 rounded-md bg-[hsl(0_0%_8%)] text-[10px] font-mono text-muted-foreground overflow-x-auto border border-border/40">
                  {tagManagerIntegration.generateSnippet('GTM-XXXXXX')}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
