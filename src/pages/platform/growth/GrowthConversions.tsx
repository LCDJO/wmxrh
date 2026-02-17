/**
 * GrowthConversions — Conversion funnel, events and predictions.
 */
import { useMemo } from 'react';
import {
  BarChart3, Target, Tag, DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { conversionTrackingService, conversionPredictionService, tagManagerIntegration } from '@/domains/platform-growth';
import { referralTrackingService } from '@/domains/platform-growth/referral-tracking-service';

export default function GrowthConversions() {
  const funnel = useMemo(() => conversionTrackingService.getConversionFunnel('lp-1'), []);
  const predictions = useMemo(() => conversionPredictionService.getBatchPredictions(), []);
  const referralSummary = useMemo(() => referralTrackingService.getSummary(), []);

  const funnelSteps = [
    { label: 'Page Views', value: funnel.views, color: 'hsl(265 80% 55%)' },
    { label: 'Signups', value: funnel.signups, color: 'hsl(200 70% 50%)' },
    { label: 'Trials', value: funnel.trials, color: 'hsl(145 60% 42%)' },
    { label: 'Tenants Created', value: funnel.tenantsCreated, color: 'hsl(30 90% 55%)' },
    { label: 'Plans Selected', value: funnel.plansSelected, color: 'hsl(340 75% 55%)' },
    { label: 'Revenue', value: funnel.revenueEvents, color: 'hsl(50 90% 50%)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Conversões</h1>
          <p className="text-sm text-muted-foreground">Funil, eventos, predições e referrals.</p>
        </div>
      </div>

      {/* Referral summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Referrals Ativos', value: referralSummary.totalReferrals },
          { label: 'Conversões Completas', value: referralSummary.completedConversions },
          { label: 'Pendentes', value: referralSummary.pendingConversions },
          { label: 'Receita Referral', value: `R$ ${referralSummary.totalRevenue.toLocaleString()}` },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/60 bg-card/60">
            <CardContent className="p-3">
              <p className="text-sm font-bold text-foreground">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="funnel" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Funil</TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />Eventos</TabsTrigger>
          <TabsTrigger value="predictions" className="gap-1.5"><Target className="h-3.5 w-3.5" />Predições</TabsTrigger>
          <TabsTrigger value="gtm" className="gap-1.5"><Tag className="h-3.5 w-3.5" />GTM</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnelSteps.map(step => {
                const width = Math.max(8, (step.value / funnel.views) * 100);
                return (
                  <div key={step.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{step.label}</span>
                      <span className="font-semibold text-foreground">{step.value.toLocaleString()}</span>
                    </div>
                    <div className="h-6 rounded-md bg-muted/30 overflow-hidden">
                      <div className="h-full rounded-md transition-all duration-700 flex items-center justify-end pr-2" style={{ width: `${width}%`, background: step.color }}>
                        {width > 15 && <span className="text-[10px] font-bold text-white">{width.toFixed(1)}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Receita total</span>
                <span className="text-lg font-bold text-emerald-400">R$ {funnel.totalRevenue.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Eventos Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {conversionTrackingService.getAll().map(evt => (
                <div key={evt.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{evt.type}</Badge>
                    <span className="text-xs text-muted-foreground">{evt.source}</span>
                    {evt.referralCode && <Badge variant="secondary" className="text-[10px]">🔗 {evt.referralCode}</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    {evt.revenue && <span className="text-xs font-semibold text-emerald-400">R$ {evt.revenue}</span>}
                    <span className="text-[10px] text-muted-foreground">{new Date(evt.trackedAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions">
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
                    )}>{pred.score}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Plano: <strong className="text-foreground">{pred.predictedPlan}</strong></p>
                  <p className="text-xs text-muted-foreground">MRR: <strong className="text-emerald-400">R$ {pred.predictedMRR}</strong></p>
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

        <TabsContent value="gtm">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-[hsl(50_80%_50%)]" />Google Tag Manager
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs font-medium text-foreground mb-1">Container ID</p>
                <code className="text-xs text-muted-foreground font-mono">GTM-XXXXXX</code>
              </div>
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
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Snippet:</p>
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
