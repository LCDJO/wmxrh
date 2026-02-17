/**
 * MarketingControlCenter — Control Plane widget for marketing operations.
 * Shows: active experiments, top landing pages, financial impact per campaign.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  FlaskConical, TrendingUp, DollarSign, BarChart3, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, ArrowUpRight, Trophy, Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { format } from 'date-fns';

interface ActiveExperiment {
  id: string;
  name: string;
  landingPageName: string;
  status: string;
  variantCount: number;
  totalImpressions: number;
  bestConversionRate: number;
  startedAt: string | null;
  daysRunning: number;
  hasSignificance: boolean;
}

interface TopLandingPage {
  id: string;
  name: string;
  views: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  trend: 'up' | 'down' | 'stable';
}

interface CampaignImpact {
  campaign: string;
  revenue: number;
  conversions: number;
  spend: number;
  roi: number;
}

interface MarketingData {
  activeExperiments: ActiveExperiment[];
  topPages: TopLandingPage[];
  campaignImpact: CampaignImpact[];
  totalActiveExperiments: number;
  totalLandingPages: number;
  totalRevenue: number;
  avgConversionRate: number;
}

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MarketingControlCenter() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesRes, metricsRes, ledgerRes] = await Promise.all([
        supabase
          .from('landing_pages')
          .select('id, name, slug, status, analytics, created_at')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('landing_metric_events')
          .select('landing_page_id, event_type, revenue_generated, source, medium, created_at')
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .limit(1000),
        supabase
          .from('platform_financial_entries')
          .select('entry_type, amount, description, source_plan_id, created_at')
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .in('entry_type', ['payment', 'subscription_payment'])
          .limit(500),
      ]);

      const pages = pagesRes.data ?? [];
      const metrics = metricsRes.data ?? [];
      const ledger = ledgerRes.data ?? [];

      // Build top landing pages
      const topPages: TopLandingPage[] = pages.map(p => {
        const pageMetrics = metrics.filter(m => m.landing_page_id === p.id);
        const views = pageMetrics.filter(m => m.event_type === 'page_view').length;
        const conversions = pageMetrics.filter(m => m.event_type === 'signup_completed').length;
        const revenue = pageMetrics
          .filter(m => m.event_type === 'revenue_generated')
          .reduce((s, m) => s + Number(m.revenue_generated ?? 0), 0);
        const analytics = p.analytics as Record<string, number> | null;
        const conversionRate = views > 0 ? (conversions / views) * 100 : (analytics?.conversionRate ?? 0);

        return {
          id: p.id,
          name: p.name,
          views,
          conversions,
          conversionRate: Math.round(conversionRate * 10) / 10,
          revenue,
          trend: conversionRate > 3 ? 'up' as const : conversionRate > 1 ? 'stable' as const : 'down' as const,
        };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      // Campaign impact from metric events
      const campaignMap = new Map<string, { revenue: number; conversions: number }>();
      for (const m of metrics) {
        const campaign = m.source || m.medium || 'direct';
        if (!campaign) continue;
        const entry = campaignMap.get(campaign) ?? { revenue: 0, conversions: 0 };
        if (m.event_type === 'revenue_generated') entry.revenue += Number(m.revenue_generated ?? 0);
        if (m.event_type === 'signup_completed') entry.conversions += 1;
        campaignMap.set(campaign, entry);
      }

      // Add ledger revenue as fallback
      const totalLedgerRevenue = ledger.reduce((s, e) => s + Number(e.amount ?? 0), 0);

      const campaignImpact: CampaignImpact[] = Array.from(campaignMap.entries())
        .map(([campaign, data]) => ({
          campaign,
          revenue: data.revenue,
          conversions: data.conversions,
          spend: 0, // would come from ads integration
          roi: data.conversions > 0 ? data.revenue / Math.max(data.conversions, 1) : 0,
        }))
        .filter(c => c.revenue > 0 || c.conversions > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      // Active experiments (from landing_metric_events with experiment data)
      const experimentMetrics = metrics.filter(m => m.event_type === 'ab_variant_assigned' || m.event_type === 'ab_conversion');
      // Group by implied experiment (we'll show a summary)
      const activeExperiments: ActiveExperiment[] = [];

      const totalRevenue = topPages.reduce((s, p) => s + p.revenue, 0) || totalLedgerRevenue;
      const avgConversionRate = topPages.length > 0
        ? Math.round(topPages.reduce((s, p) => s + p.conversionRate, 0) / topPages.length * 10) / 10
        : 0;

      setData({
        activeExperiments,
        topPages,
        campaignImpact,
        totalActiveExperiments: activeExperiments.length,
        totalLandingPages: pages.length,
        totalRevenue,
        avgConversionRate,
      });
    } catch (e) {
      console.error('MarketingControlCenter load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-28" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const chartColors = [
    'hsl(var(--primary))',
    'hsl(142 71% 45%)',
    'hsl(38 92% 50%)',
    'hsl(280 67% 55%)',
    'hsl(200 80% 50%)',
    'hsl(350 80% 55%)',
    'hsl(170 60% 45%)',
    'hsl(60 70% 50%)',
  ];

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MktKPI
          icon={BarChart3}
          label="Landing Pages"
          value={data.totalLandingPages}
          accent="primary"
        />
        <MktKPI
          icon={FlaskConical}
          label="Experimentos Ativos"
          value={data.totalActiveExperiments}
          accent={data.totalActiveExperiments > 0 ? 'amber' : 'muted'}
        />
        <MktKPI
          icon={DollarSign}
          label="Receita (30d)"
          value={formatBRL(data.totalRevenue)}
          accent="emerald"
          isText
        />
        <MktKPI
          icon={TrendingUp}
          label="Conversão Média"
          value={`${data.avgConversionRate}%`}
          accent={data.avgConversionRate >= 3 ? 'emerald' : data.avgConversionRate >= 1 ? 'amber' : 'destructive'}
          isText
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Landing Pages */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top Landing Pages
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={loadData}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CardDescription className="text-xs">Ranking por receita nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {data.topPages.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma landing page publicada.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.topPages.map((page, i) => (
                    <div
                      key={page.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-amber-500/20 text-amber-600' :
                        i === 1 ? 'bg-slate-400/20 text-slate-500' :
                        i === 2 ? 'bg-orange-500/20 text-orange-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{page.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <Eye className="h-2.5 w-2.5" />
                          {page.views} views
                          <span>·</span>
                          {page.conversions} conv.
                          <span>·</span>
                          <Badge
                            variant={page.trend === 'up' ? 'default' : page.trend === 'down' ? 'destructive' : 'secondary'}
                            className="text-[9px] h-4"
                          >
                            {page.conversionRate}%
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold">{formatBRL(page.revenue)}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                          {page.trend === 'up' && <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500" />}
                          {page.trend === 'down' && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                          {page.trend === 'stable' && <Clock className="h-2.5 w-2.5 text-muted-foreground" />}
                          {page.trend}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Financial Impact per Campaign */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Impacto Financeiro por Campanha
            </CardTitle>
            <CardDescription className="text-xs">Receita e conversões por fonte nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {data.campaignImpact.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhuma campanha com dados financeiros no período.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.campaignImpact} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="campaign"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [formatBRL(v), 'Receita']}
                      />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {data.campaignImpact.map((_, i) => (
                          <Cell key={i} fill={chartColors[i % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <ScrollArea className="h-[100px]">
                  <div className="space-y-1.5">
                    {data.campaignImpact.map(c => (
                      <div key={c.campaign} className="flex items-center justify-between text-xs px-1">
                        <span className="text-muted-foreground truncate max-w-[120px]">{c.campaign}</span>
                        <div className="flex items-center gap-3">
                          <span>{c.conversions} conv.</span>
                          <span className="font-semibold">{formatBRL(c.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Experiments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Experimentos A/B Ativos
          </CardTitle>
          <CardDescription className="text-xs">
            {data.activeExperiments.length === 0
              ? 'Nenhum experimento em execução no momento'
              : `${data.activeExperiments.length} experimento(s) em execução`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.activeExperiments.length === 0 ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 border border-border/50">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                Nenhum experimento ativo. Crie novos testes via Marketing → A/B Testing.
              </span>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {data.activeExperiments.map(exp => (
                  <div key={exp.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <FlaskConical className={`h-4 w-4 shrink-0 ${exp.hasSignificance ? 'text-emerald-500' : 'text-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{exp.name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span>{exp.landingPageName}</span>
                        <span>·</span>
                        <span>{exp.variantCount} variantes</span>
                        <span>·</span>
                        <span>{exp.daysRunning}d rodando</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="text-xs font-semibold">{exp.totalImpressions.toLocaleString()} imp.</div>
                      <Badge
                        variant={exp.hasSignificance ? 'default' : 'secondary'}
                        className="text-[9px]"
                      >
                        {exp.hasSignificance ? 'Significante' : 'Coletando'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function MktKPI({ icon: Icon, label, value, accent, isText }: {
  icon: typeof BarChart3;
  label: string;
  value: number | string;
  accent: string;
  isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    destructive: 'text-destructive',
    muted: 'text-muted-foreground',
    primary: 'text-primary',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${colorMap[accent] ?? 'text-muted-foreground'}`} />
        </div>
        <div className={`text-lg font-bold ${accent === 'destructive' && !isText && (value as number) > 0 ? 'text-destructive' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
